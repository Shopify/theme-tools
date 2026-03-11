"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.traverseModule = traverseModule;
exports.bind = bind;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const utils_1 = require("../utils");
const module_1 = require("./module");
async function traverseModule(module, themeGraph, deps) {
    // If the module is already traversed, skip it
    if (themeGraph.modules[module.uri]) {
        return;
    }
    // Signal to all users that the file is being traversed
    // This will prevent multiple traversals of the same file
    themeGraph.modules[module.uri] = module;
    // Check if the module exists on disk
    module.exists = await (0, utils_1.exists)(deps.fs, module.uri);
    // If the module doesn't exist, we can't traverse it
    if (!module.exists) {
        return;
    }
    switch (module.type) {
        case "Liquid" /* ModuleType.Liquid */: {
            return traverseLiquidModule(module, themeGraph, deps);
        }
        case "JSON" /* ModuleType.Json */: {
            return traverseJsonModule(module, themeGraph, deps);
        }
        case "JavaScript" /* ModuleType.JavaScript */: {
            return; // TODO graph import/exports ?
        }
        case "CSS" /* ModuleType.Css */:
        case "SVG" /* ModuleType.Svg */:
        case "Image" /* ModuleType.Image */: {
            return; // Nothing to do??
        }
        default: {
            return (0, utils_1.assertNever)(module);
        }
    }
}
async function traverseLiquidModule(module, themeGraph, deps) {
    const sourceCode = await deps.getSourceCode(module.uri);
    if (sourceCode.ast instanceof Error)
        return; // can't visit what you can't parse
    const visitor = {
        // {{ 'theme.js' | asset_url }}
        // {{ 'image.png' | asset_img_url }}
        // {{ 'icon.svg' | inline_asset_content }}
        LiquidFilter: (node, ancestors) => {
            if (['asset_url', 'asset_img_url', 'inline_asset_content'].includes(node.name)) {
                const parentNode = ancestors[ancestors.length - 1];
                if (parentNode.type !== liquid_html_parser_1.NodeTypes.LiquidVariable)
                    return;
                if (parentNode.expression.type !== liquid_html_parser_1.NodeTypes.String)
                    return;
                if (parentNode.filters[0] !== node)
                    return;
                const asset = parentNode.expression.value;
                const module = (0, module_1.getAssetModule)(themeGraph, asset);
                if (!module)
                    return;
                return {
                    target: module,
                    sourceRange: [parentNode.position.start, parentNode.position.end],
                };
            }
        },
        // {% content_for 'block', type: 'staticBlockName', id: 'id' %}
        ContentForMarkup: (node, ancestors) => {
            const parentNode = ancestors.at(-1);
            if (node.contentForType.value !== 'block')
                return;
            const blockTypeArg = node.args.find((arg) => arg.name === 'type');
            if (!blockTypeArg)
                return;
            const blockTypeValue = blockTypeArg.value;
            if (blockTypeValue.type !== liquid_html_parser_1.NodeTypes.String)
                return;
            const blockType = blockTypeValue.value;
            return {
                target: (0, module_1.getThemeBlockModule)(themeGraph, blockType),
                sourceRange: [parentNode.position.start, node.position.end],
            };
        },
        // <custom-element></custom-element>
        HtmlElement: (node) => {
            if (node.name.length !== 1)
                return;
            if (node.name[0].type !== liquid_html_parser_1.NodeTypes.TextNode)
                return;
            const nodeNameNode = node.name[0];
            const nodeName = nodeNameNode.value;
            if (!nodeName.includes('-'))
                return; // skip non-custom-elements
            const result = deps.getWebComponentDefinitionReference(nodeName);
            if (!result)
                return;
            const { assetName, range } = result;
            const module = (0, module_1.getAssetModule)(themeGraph, assetName);
            if (!module)
                return;
            return {
                target: module,
                sourceRange: [node.blockStartPosition.start, nodeNameNode.position.end],
                targetRange: range,
            };
        },
        // {% render 'snippet' %}
        RenderMarkup: (node, ancestors) => {
            const snippet = node.snippet;
            const tag = ancestors.at(-1);
            if (!(0, utils_1.isString)(snippet) && snippet.type === liquid_html_parser_1.NodeTypes.String) {
                return {
                    target: (0, module_1.getSnippetModule)(themeGraph, snippet.value),
                    sourceRange: [tag.position.start, tag.position.end],
                };
            }
        },
        LiquidTag: (node) => {
            switch (node.name) {
                // {% sections 'section-group' %}
                case liquid_html_parser_1.NamedTags.sections: {
                    if (!(0, utils_1.isString)(node.markup)) {
                        const sectionGroupType = node.markup.value;
                        return {
                            target: (0, module_1.getSectionGroupModule)(themeGraph, sectionGroupType),
                            sourceRange: [node.position.start, node.position.end],
                        };
                    }
                }
                // {% section 'section' %}
                case liquid_html_parser_1.NamedTags.section: {
                    if (!(0, utils_1.isString)(node.markup)) {
                        const sectionType = node.markup.value;
                        return {
                            target: (0, module_1.getSectionModule)(themeGraph, sectionType),
                            sourceRange: [node.position.start, node.position.end],
                        };
                    }
                }
            }
        },
    };
    const references = (0, theme_check_common_1.visit)(sourceCode.ast, visitor);
    for (const reference of references) {
        bind(module, reference.target, {
            sourceRange: reference.sourceRange,
            targetRange: reference.targetRange,
        });
    }
    const modules = (0, utils_1.unique)(references.map((ref) => ref.target));
    const promises = modules.map((mod) => traverseModule(mod, themeGraph, deps));
    // Look at schema references if any
    if (module.kind === "section" /* LiquidModuleKind.Section */) {
        const sectionName = theme_check_common_1.path.basename(module.uri, '.liquid');
        const sectionSchema = await deps.getSectionSchema(sectionName);
        promises.push(traverseLiquidSchema(sectionSchema, module, themeGraph, deps));
    }
    else if (module.kind === "block" /* LiquidModuleKind.Block */) {
        const blockName = theme_check_common_1.path.basename(module.uri, '.liquid');
        const blockSchema = await deps.getBlockSchema(blockName);
        promises.push(traverseLiquidSchema(blockSchema, module, themeGraph, deps));
    }
    return Promise.all(promises);
}
async function traverseLiquidSchema(schema, module, themeGraph, deps) {
    if (!schema)
        return;
    const isSection = module.kind === "section" /* LiquidModuleKind.Section */;
    const hasLocalBlocks = isSection && (await (0, utils_1.acceptsLocalBlocks)(theme_check_common_1.path.basename(module.uri, '.liquid'), deps));
    if (hasLocalBlocks)
        return;
    const { ast, validSchema } = schema;
    if (validSchema instanceof Error || ast instanceof Error)
        return;
    const promises = [];
    // Traverse the blocks
    if (validSchema.blocks) {
        promises.push(traverseSchemaBlocks(schema, module, ast, validSchema.blocks, themeGraph, deps));
    }
    // Traverse the presets
    if (validSchema.presets) {
        promises.push(traverseSchemaPresets(schema, module, ast, validSchema.presets, themeGraph, deps));
    }
    // Traverse section.default if it exists
    if ('default' in validSchema && validSchema.default) {
        promises.push(traverseSchemaDefault(schema, module, ast, validSchema.default, themeGraph, deps));
    }
    return Promise.all(promises);
}
async function traverseSchemaBlocks(schema, module, ast, blocks, themeGraph, deps) {
    const promises = [];
    for (const [i, blockDef] of Object.entries(blocks)) {
        const nodePath = ['blocks', i];
        const node = (0, theme_check_common_1.nodeAtPath)(ast, nodePath);
        const typeProperty = node.children.find((child) => child.key.value === 'type');
        if (!typeProperty)
            continue;
        const sourceRange = [
            schema.offset + typeProperty.loc.start.offset,
            schema.offset + typeProperty.loc.end.offset,
        ];
        // blocks: [{ "type": "@theme" }, { "type": "custom-block" }]
        switch (blockDef.type) {
            case '@theme': {
                const publicBlocks = await deps
                    .getThemeBlockNames()
                    .then((blocks) => blocks.filter((name) => !name.startsWith('_')));
                for (const publicBlock of publicBlocks) {
                    const blockModule = (0, module_1.getThemeBlockModule)(themeGraph, theme_check_common_1.path.basename(publicBlock, '.liquid'));
                    bind(module, blockModule, { sourceRange, type: 'indirect' });
                    promises.push(traverseModule(blockModule, themeGraph, deps));
                }
                break;
            }
            case '@app': {
                break;
            }
            default: {
                const blockModule = (0, module_1.getThemeBlockModule)(themeGraph, blockDef.type);
                bind(module, blockModule, { sourceRange });
                promises.push(traverseModule(blockModule, themeGraph, deps));
            }
        }
    }
    return Promise.all(promises);
}
async function traverseSchemaPresets(schema, module, ast, presets, themeGraph, deps) {
    const promises = [];
    for (const [i, preset] of presets.entries()) {
        if (!('blocks' in preset))
            continue;
        // Iterate over array entries or object entries depending on how the blocks are defined
        const iterator = Array.isArray(preset.blocks)
            ? preset.blocks.entries()
            : Object.entries(preset.blocks);
        for (const [keyOrIndex, block] of iterator) {
            const nodePath = ['presets', i, 'blocks', keyOrIndex];
            const node = (0, theme_check_common_1.nodeAtPath)(ast, nodePath);
            const blockModule = (0, module_1.getThemeBlockModule)(themeGraph, block.type);
            if (!blockModule)
                continue;
            const typeProperty = node.children.find((child) => child.key.value === 'type');
            if (!typeProperty)
                continue;
            const sourceRange = [
                schema.offset + typeProperty.loc.start.offset,
                schema.offset + typeProperty.loc.end.offset,
            ];
            bind(module, blockModule, { sourceRange, type: 'preset' });
            promises.push(traverseModule(blockModule, themeGraph, deps));
            if (block.blocks) {
                promises.push(traverseSchemaPresetBlock(schema, module, ast, block.blocks, nodePath, themeGraph, deps));
            }
        }
    }
    return Promise.all(promises);
}
async function traverseSchemaPresetBlock(schema, module, ast, blocks, parentPath, themeGraph, deps) {
    const promises = [];
    // Iterate over array entries or object entries depending on how the blocks are defined
    const iterator = Array.isArray(blocks) ? blocks.entries() : Object.entries(blocks);
    for (const [keyOrIndex, block] of iterator) {
        const nodePath = [...parentPath, 'blocks', keyOrIndex];
        const node = (0, theme_check_common_1.nodeAtPath)(ast, nodePath);
        const blockModule = (0, module_1.getThemeBlockModule)(themeGraph, block.type);
        if (!blockModule)
            continue;
        const typeProperty = node.children.find((child) => child.key.value === 'type');
        if (!typeProperty)
            continue;
        const sourceRange = [
            schema.offset + typeProperty.loc.start.offset,
            schema.offset + typeProperty.loc.end.offset,
        ];
        bind(module, blockModule, { sourceRange, type: 'preset' });
        promises.push(traverseModule(blockModule, themeGraph, deps));
        if (block.blocks) {
            promises.push(traverseSchemaPresetBlock(schema, module, ast, block.blocks, nodePath, themeGraph, deps));
        }
    }
    return Promise.all(promises);
}
async function traverseSchemaDefault(schema, module, ast, preset, themeGraph, deps) {
    const promises = [];
    if (!('blocks' in preset))
        return;
    // Iterate over array entries or object entries depending on how the blocks are defined
    const iterator = Array.isArray(preset.blocks)
        ? preset.blocks.entries()
        : Object.entries(preset.blocks);
    for (const [keyOrIndex, block] of iterator) {
        const nodePath = ['default', 'blocks', keyOrIndex];
        const node = (0, theme_check_common_1.nodeAtPath)(ast, nodePath);
        const blockModule = (0, module_1.getThemeBlockModule)(themeGraph, block.type);
        if (!blockModule)
            continue;
        const typeProperty = node.children.find((child) => child.key.value === 'type');
        if (!typeProperty)
            continue;
        const sourceRange = [
            schema.offset + typeProperty.loc.start.offset,
            schema.offset + typeProperty.loc.end.offset,
        ];
        bind(module, blockModule, { sourceRange, type: 'preset' });
        promises.push(traverseModule(blockModule, themeGraph, deps));
    }
    return Promise.all(promises);
}
async function traverseJsonModule(module, themeGraph, deps) {
    const sourceCode = await deps.getSourceCode(module.uri);
    if (sourceCode.type !== theme_check_common_1.SourceCodeType.JSON)
        throw (0, utils_1.unexpected)();
    const ast = sourceCode.ast;
    if (ast instanceof Error)
        return; // can't visit what you can't parse
    switch (module.kind) {
        case "template" /* JsonModuleKind.Template */: {
            // Should only happen once per template
            const template = (0, theme_check_common_1.parseJSON)(sourceCode.source);
            const promises = [];
            for (const [key, section] of Object.entries(template.sections)) {
                const sectionType = section.type;
                const path = ['sections', key];
                const node = (0, theme_check_common_1.nodeAtPath)(ast, path);
                const sectionModule = (0, module_1.getSectionModule)(themeGraph, sectionType);
                const typeProperty = node.children.find((child) => child.key.value === 'type');
                const start = typeProperty.loc.start.offset;
                const end = typeProperty.loc.end.offset;
                const sourceRange = [start, end];
                // Link the template to the section
                bind(module, sectionModule, { sourceRange });
                promises.push(
                // Traverse the section themeselves
                traverseModule(sectionModule, themeGraph, deps), 
                // Link the blocks used in the section to the template
                traverseSectionReferences(module, ast, path, section, themeGraph, deps));
            }
            // Link the template to the layout
            const layout = template.layout;
            const layoutModule = (0, module_1.getLayoutModule)(themeGraph, template.layout);
            if (layoutModule) {
                let sourceRange = undefined;
                let indirect = true;
                if (layout !== false && layout !== undefined) {
                    const layoutPath = ['layout'];
                    const node = (0, theme_check_common_1.nodeAtPath)(ast, layoutPath);
                    sourceRange = [node.loc.start.offset, node.loc.end.offset];
                    indirect = false; // this is a direct reference to the layout
                }
                bind(module, layoutModule, { sourceRange, type: 'indirect' });
                promises.push(traverseModule(layoutModule, themeGraph, deps));
            }
            return Promise.all(promises);
        }
        case "section-group" /* JsonModuleKind.SectionGroup */: {
            const sectionGroup = (0, theme_check_common_1.parseJSON)(sourceCode.source);
            const promises = [];
            for (const [key, section] of Object.entries(sectionGroup.sections)) {
                const sectionType = section.type;
                const path = ['sections', key];
                const node = (0, theme_check_common_1.nodeAtPath)(ast, path);
                const sectionModule = (0, module_1.getSectionModule)(themeGraph, sectionType);
                const typeProperty = node.children.find((child) => child.key.value === 'type');
                const start = typeProperty.loc.start.offset;
                const end = typeProperty.loc.end.offset;
                const sourceRange = [start, end];
                // Link the template to the section
                bind(module, sectionModule, { sourceRange });
                promises.push(
                // Traverse the section themeselves
                traverseModule(sectionModule, themeGraph, deps), 
                // Link the blocks used in the section to the template
                traverseSectionReferences(module, ast, path, section, themeGraph, deps));
            }
            return Promise.all(promises);
        }
        default: {
            return (0, utils_1.assertNever)(module.kind);
        }
    }
}
/**
 * Traverses the actual references contained inside Template.Template['sections'] and Template.SectionGroup['sections'].
 *
 * Does nothing if the mode is not `GraphMode.Production`.
 */
async function traverseSectionReferences(source, // template or section group
sourceAst, nodePath = [], section, themeGraph, deps) {
    if (!section.blocks)
        return;
    const sectionHasLocalBlocks = await (0, utils_1.acceptsLocalBlocks)(section.type, deps);
    if (sectionHasLocalBlocks)
        return;
    const promises = [];
    for (const [key, block] of Object.entries(section.blocks)) {
        const blockType = block.type;
        const blockModule = (0, module_1.getThemeBlockModule)(themeGraph, blockType);
        const path = [...nodePath, 'blocks', key];
        const node = (0, theme_check_common_1.nodeAtPath)(sourceAst, path);
        const typeProperty = node.children.find((child) => child.key.value === 'type');
        const start = typeProperty.loc.start.offset;
        const end = typeProperty.loc.end.offset;
        const sourceRange = [start, end];
        // Link the template to the block
        bind(source, blockModule, { sourceRange });
        promises.push(
        // Traverse the block themselves
        traverseModule(blockModule, themeGraph, deps), 
        // Traverse the block references
        traverseBlockReferences(source, sourceAst, path, block, themeGraph, deps));
    }
    return Promise.all(promises);
}
async function traverseBlockReferences(source, // template or section group
sourceAst, nodePath = [], block, themeGraph, deps) {
    if (!block.blocks)
        return;
    const promises = [];
    for (const [key, childBlock] of Object.entries(block.blocks)) {
        const childBlockType = childBlock.type;
        const childBlockModule = (0, module_1.getThemeBlockModule)(themeGraph, childBlockType);
        const path = [...nodePath, 'blocks', key];
        const node = (0, theme_check_common_1.nodeAtPath)(sourceAst, path);
        const typeProperty = node.children.find((child) => child.key.value === 'type');
        const start = typeProperty.loc.start.offset;
        const end = typeProperty.loc.end.offset;
        const sourceRange = [start, end];
        // Link the template/section group to the block
        bind(source, childBlockModule, { sourceRange });
        promises.push(
        // Traverse the child block themselves
        traverseModule(childBlockModule, themeGraph, deps), 
        // Traverse the child block references
        traverseBlockReferences(source, sourceAst, path, childBlock, themeGraph, deps));
    }
    return Promise.all(promises);
}
/**
 * The bind method is the method that links two modules together.
 *
 * It adds the dependency to the source module's dependencies and the target module's references.
 *
 * This function mutates the source and target modules.
 */
function bind(source, target, { sourceRange, targetRange, type = 'direct', // the type of dependency, can be 'direct', 'indirect' or 'preset'
 } = {}) {
    const dependency = {
        source: { uri: source.uri, range: sourceRange },
        target: { uri: target.uri, range: targetRange },
        type: type,
    };
    source.dependencies.push(dependency);
    target.references.push(dependency);
}
//# sourceMappingURL=traverse.js.map