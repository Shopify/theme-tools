import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import {
  JSONNode,
  nodeAtPath,
  ObjectNode,
  parseJSON,
  path,
  Preset,
  Section,
  SectionSchema,
  SourceCodeType,
  Template,
  ThemeBlock,
  ThemeBlockSchema,
  visit,
  Visitor,
} from '@shopify/theme-check-common';
import {
  AugmentedDependencies,
  JsonModule,
  JsonModuleKind,
  LiquidModule,
  LiquidModuleKind,
  ModuleType,
  Range,
  Reference,
  ThemeGraph,
  ThemeModule,
  Void,
} from '../types';
import { acceptsLocalBlocks, assertNever, exists, isString, unexpected, unique } from '../utils';
import {
  getAssetModule,
  getLayoutModule,
  getSectionGroupModule,
  getSectionModule,
  getSnippetModule,
  getThemeBlockModule,
} from './module';

export async function traverseModule(
  module: ThemeModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  // If the module is already traversed, skip it
  if (themeGraph.modules[module.uri]) {
    return;
  }

  // Signal to all users that the file is being traversed
  // This will prevent multiple traversals of the same file
  themeGraph.modules[module.uri] = module;

  // Check if the module exists on disk
  module.exists = await exists(deps.fs, module.uri);

  // If the module doesn't exist, we can't traverse it
  if (!module.exists) {
    return;
  }

  switch (module.type) {
    case ModuleType.Liquid: {
      return traverseLiquidModule(module, themeGraph, deps);
    }

    case ModuleType.Json: {
      return traverseJsonModule(module, themeGraph, deps);
    }

    case ModuleType.JavaScript: {
      return; // TODO graph import/exports ?
    }

    case ModuleType.Css: {
      return; // Nothing to do??
    }

    default: {
      return assertNever(module);
    }
  }
}

async function traverseLiquidModule(
  module: LiquidModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
) {
  const sourceCode = await deps.getSourceCode(module.uri);

  if (sourceCode.ast instanceof Error) return; // can't visit what you can't parse

  const visitor: Visitor<
    SourceCodeType.LiquidHtml,
    { target: ThemeModule; sourceRange: Range; targetRange?: Range }
  > = {
    // {{ 'theme.js' | asset_url }}
    // {{ 'theme.css' | asset_url }}
    LiquidFilter: (node, ancestors) => {
      if (node.name === 'asset_url') {
        const parentNode = ancestors[ancestors.length - 1]!;
        if (parentNode.type !== NodeTypes.LiquidVariable) return;
        if (parentNode.expression.type !== NodeTypes.String) return;
        if (parentNode.filters[0] !== node) return;
        const asset = parentNode.expression.value;
        const module = getAssetModule(themeGraph, asset);
        if (!module) return;
        return {
          target: module,
          sourceRange: [parentNode.position.start, parentNode.position.end],
        };
      }
    },

    // {% content_for 'block', type: 'staticBlockName', id: 'id' %}
    ContentForMarkup: (node, ancestors) => {
      const parentNode = ancestors.at(-1)!;
      if (node.contentForType.value !== 'block') return;
      const blockTypeArg = node.args.find((arg) => arg.name === 'type');
      if (!blockTypeArg) return;

      const blockTypeValue = blockTypeArg.value;
      if (blockTypeValue.type !== NodeTypes.String) return;

      const blockType = blockTypeValue.value;

      return {
        target: getThemeBlockModule(themeGraph, blockType),
        sourceRange: [parentNode.position.start, node.position.end],
      };
    },

    // <custom-element></custom-element>
    HtmlElement: (node) => {
      if (node.name.length !== 1) return;
      if (node.name[0].type !== NodeTypes.TextNode) return;
      const nodeNameNode = node.name[0];
      const nodeName = nodeNameNode.value;
      if (!nodeName.includes('-')) return; // skip non-custom-elements

      const result = deps.getWebComponentDefinitionReference(nodeName);
      if (!result) return;
      const { assetName, range } = result;
      const module = getAssetModule(themeGraph, assetName);
      if (!module) return;

      return {
        target: module,
        sourceRange: [node.blockStartPosition.start, nodeNameNode.position.end],
        targetRange: range,
      };
    },

    // {% render 'snippet' %}
    RenderMarkup: (node, ancestors) => {
      const snippet = node.snippet;
      const tag = ancestors.at(-1)!;
      if (!isString(snippet) && snippet.type === NodeTypes.String) {
        return {
          target: getSnippetModule(themeGraph, snippet.value),
          sourceRange: [tag.position.start, tag.position.end],
        };
      }
    },

    LiquidTag: (node) => {
      switch (node.name) {
        // {% sections 'section-group' %}
        case NamedTags.sections: {
          if (!isString(node.markup)) {
            const sectionGroupType = node.markup.value;
            return {
              target: getSectionGroupModule(themeGraph, sectionGroupType),
              sourceRange: [node.position.start, node.position.end],
            };
          }
        }

        // {% section 'section' %}
        case NamedTags.section: {
          if (!isString(node.markup)) {
            const sectionType = node.markup.value;
            return {
              target: getSectionModule(themeGraph, sectionType),
              sourceRange: [node.position.start, node.position.end],
            };
          }
        }
      }
    },
  };

  const references = visit(sourceCode.ast, visitor);

  for (const reference of references) {
    bind(module, reference.target, {
      sourceRange: reference.sourceRange,
      targetRange: reference.targetRange,
    });
  }

  const modules = unique(references.map((ref) => ref.target));
  const promises = modules.map((mod) => traverseModule(mod, themeGraph, deps));

  // Look at schema references if any
  if (module.kind === LiquidModuleKind.Section) {
    const sectionName = path.basename(module.uri, '.liquid');
    const sectionSchema = await deps.getSectionSchema(sectionName);
    promises.push(traverseLiquidSchema(sectionSchema, module, themeGraph, deps));
  } else if (module.kind === LiquidModuleKind.Block) {
    const blockName = path.basename(module.uri, '.liquid');
    const blockSchema = await deps.getBlockSchema(blockName);
    promises.push(traverseLiquidSchema(blockSchema, module, themeGraph, deps));
  }

  return Promise.all(promises);
}

async function traverseLiquidSchema(
  schema: SectionSchema | ThemeBlockSchema | undefined,
  module: LiquidModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  if (!schema) return;

  const isSection = module.kind === LiquidModuleKind.Section;
  const hasLocalBlocks =
    isSection && (await acceptsLocalBlocks(path.basename(module.uri, '.liquid'), deps));
  if (hasLocalBlocks) return;

  const { ast, validSchema } = schema;
  if (validSchema instanceof Error || ast instanceof Error) return;

  const promises: Promise<Void>[] = [];

  // Traverse the blocks
  if (validSchema.blocks) {
    promises.push(traverseSchemaBlocks(schema, module, ast, validSchema.blocks, themeGraph, deps));
  }

  // Traverse the presets
  if (validSchema.presets) {
    promises.push(
      traverseSchemaPresets(schema, module, ast, validSchema.presets, themeGraph, deps),
    );
  }

  // Traverse section.default if it exists
  if ('default' in validSchema && validSchema.default) {
    promises.push(
      traverseSchemaDefault(
        schema as SectionSchema,
        module,
        ast,
        validSchema.default,
        themeGraph,
        deps,
      ),
    );
  }

  return Promise.all(promises);
}

async function traverseSchemaBlocks(
  schema: SectionSchema | ThemeBlockSchema,
  module: LiquidModule,
  ast: JSONNode,
  blocks: Section.Block[] | ThemeBlock.Block[],
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
) {
  const promises: Promise<Void>[] = [];

  for (const [i, blockDef] of Object.entries(blocks)) {
    const nodePath = ['blocks', i];
    const node = nodeAtPath(ast, nodePath)! as ObjectNode;
    const typeProperty = node.children.find((child) => child.key.value === 'type');
    if (!typeProperty) continue;

    const sourceRange: Range = [
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
          const blockModule = getThemeBlockModule(
            themeGraph,
            path.basename(publicBlock, '.liquid'),
          );
          bind(module, blockModule, { sourceRange, type: 'indirect' });
          promises.push(traverseModule(blockModule, themeGraph, deps));
        }

        break;
      }

      case '@app': {
        break;
      }

      default: {
        const blockModule = getThemeBlockModule(themeGraph, blockDef.type);
        bind(module, blockModule, { sourceRange });
        promises.push(traverseModule(blockModule, themeGraph, deps));
      }
    }
  }

  return Promise.all(promises);
}

async function traverseSchemaPresets(
  schema: SectionSchema | ThemeBlockSchema,
  module: LiquidModule,
  ast: JSONNode,
  presets: Preset.Preset[],
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
) {
  const promises: Promise<Void>[] = [];

  for (const [i, preset] of presets.entries()) {
    if (!('blocks' in preset)) continue;

    // Iterate over array entries or object entries depending on how the blocks are defined
    const iterator = Array.isArray(preset.blocks)
      ? preset.blocks.entries()
      : Object.entries(preset.blocks!);

    for (const [keyOrIndex, block] of iterator) {
      const nodePath = ['presets', i, 'blocks', keyOrIndex];
      const node = nodeAtPath(ast, nodePath)! as ObjectNode;

      const blockModule = getThemeBlockModule(themeGraph, block.type);
      if (!blockModule) continue;

      const typeProperty = node.children.find((child) => child.key.value === 'type');
      if (!typeProperty) continue;

      const sourceRange: Range = [
        schema.offset + typeProperty.loc.start.offset,
        schema.offset + typeProperty.loc.end.offset,
      ];

      bind(module, blockModule, { sourceRange, type: 'preset' });
      promises.push(traverseModule(blockModule, themeGraph, deps));
      if (block.blocks) {
        promises.push(
          traverseSchemaPresetBlock(schema, module, ast, block.blocks, nodePath, themeGraph, deps),
        );
      }
    }
  }

  return Promise.all(promises);
}

async function traverseSchemaPresetBlock(
  schema: SectionSchema | ThemeBlockSchema,
  module: LiquidModule,
  ast: JSONNode,
  blocks: Preset.PresetBlockHash | Preset.PresetBlockForArray[],
  parentPath: (string | number)[],
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
) {
  const promises: Promise<Void>[] = [];

  // Iterate over array entries or object entries depending on how the blocks are defined
  const iterator = Array.isArray(blocks) ? blocks.entries() : Object.entries(blocks);

  for (const [keyOrIndex, block] of iterator) {
    const nodePath = [...parentPath, 'blocks', keyOrIndex];
    const node = nodeAtPath(ast, nodePath)! as ObjectNode;

    const blockModule = getThemeBlockModule(themeGraph, block.type);
    if (!blockModule) continue;

    const typeProperty = node.children.find((child) => child.key.value === 'type');
    if (!typeProperty) continue;

    const sourceRange: Range = [
      schema.offset + typeProperty.loc.start.offset,
      schema.offset + typeProperty.loc.end.offset,
    ];

    bind(module, blockModule, { sourceRange, type: 'preset' });
    promises.push(traverseModule(blockModule, themeGraph, deps));
    if (block.blocks) {
      promises.push(
        traverseSchemaPresetBlock(schema, module, ast, block.blocks, nodePath, themeGraph, deps),
      );
    }
  }

  return Promise.all(promises);
}

async function traverseSchemaDefault(
  schema: SectionSchema,
  module: LiquidModule,
  ast: JSONNode,
  preset: Section.Default,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
) {
  const promises: Promise<Void>[] = [];

  if (!('blocks' in preset)) return;

  // Iterate over array entries or object entries depending on how the blocks are defined
  const iterator = Array.isArray(preset.blocks)
    ? preset.blocks.entries()
    : Object.entries(preset.blocks!);

  for (const [keyOrIndex, block] of iterator) {
    const nodePath = ['default', 'blocks', keyOrIndex];
    const node = nodeAtPath(ast, nodePath)! as ObjectNode;

    const blockModule = getThemeBlockModule(themeGraph, block.type);
    if (!blockModule) continue;

    const typeProperty = node.children.find((child) => child.key.value === 'type');
    if (!typeProperty) continue;

    const sourceRange: Range = [
      schema.offset + typeProperty.loc.start.offset,
      schema.offset + typeProperty.loc.end.offset,
    ];

    bind(module, blockModule, { sourceRange, type: 'preset' });
    promises.push(traverseModule(blockModule, themeGraph, deps));
  }

  return Promise.all(promises);
}

async function traverseJsonModule(
  module: JsonModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  const sourceCode = await deps.getSourceCode(module.uri);
  if (sourceCode.type !== SourceCodeType.JSON) throw unexpected();
  const ast = sourceCode.ast;
  if (ast instanceof Error) return; // can't visit what you can't parse

  switch (module.kind) {
    case JsonModuleKind.Template: {
      // Should only happen once per template
      const template = parseJSON(sourceCode.source) as Template.Template;
      const promises: Promise<Void>[] = [];
      for (const [key, section] of Object.entries(template.sections)) {
        const sectionType = section.type;
        const path = ['sections', key];
        const node = nodeAtPath(ast, path)! as ObjectNode;
        const sectionModule = getSectionModule(themeGraph, sectionType);
        const typeProperty = node.children.find((child) => child.key.value === 'type')!;
        const start = typeProperty.loc.start.offset;
        const end = typeProperty.loc.end.offset;
        const sourceRange: Range = [start, end];
        // Link the template to the section
        bind(module, sectionModule, { sourceRange });
        promises.push(
          // Traverse the section themeselves
          traverseModule(sectionModule, themeGraph, deps),
          // Link the blocks used in the section to the template
          traverseSectionReferences(module, ast, path, section, themeGraph, deps),
        );
      }

      // Link the template to the layout
      const layout = template.layout;
      const layoutModule = getLayoutModule(themeGraph, template.layout);
      if (layoutModule) {
        let sourceRange: Range | undefined = undefined;
        let indirect = true;
        if (layout !== false && layout !== undefined) {
          const layoutPath = ['layout'];
          const node = nodeAtPath(ast, layoutPath)!;
          sourceRange = [node.loc.start.offset, node.loc.end.offset];
          indirect = false; // this is a direct reference to the layout
        }
        bind(module, layoutModule, { sourceRange, type: 'indirect' });
        promises.push(traverseModule(layoutModule, themeGraph, deps));
      }

      return Promise.all(promises);
    }

    case JsonModuleKind.SectionGroup: {
      const sectionGroup = parseJSON(sourceCode.source) as Template.SectionGroup;
      const promises: Promise<Void>[] = [];
      for (const [key, section] of Object.entries(sectionGroup.sections)) {
        const sectionType = section.type;
        const path = ['sections', key];
        const node = nodeAtPath(ast, path)! as ObjectNode;
        const sectionModule = getSectionModule(themeGraph, sectionType);

        const typeProperty = node.children.find((child) => child.key.value === 'type')!;
        const start = typeProperty.loc.start.offset;
        const end = typeProperty.loc.end.offset;
        const sourceRange: Range = [start, end];

        // Link the template to the section
        bind(module, sectionModule, { sourceRange });
        promises.push(
          // Traverse the section themeselves
          traverseModule(sectionModule, themeGraph, deps),
          // Link the blocks used in the section to the template
          traverseSectionReferences(module, ast, path, section, themeGraph, deps),
        );
      }

      return Promise.all(promises);
    }

    default: {
      return assertNever(module.kind);
    }
  }
}

/**
 * Traverses the actual references contained inside Template.Template['sections'] and Template.SectionGroup['sections'].
 *
 * Does nothing if the mode is not `GraphMode.Production`.
 */
async function traverseSectionReferences(
  source: ThemeModule, // template or section group
  sourceAst: JSONNode,
  nodePath: string[] = [],
  section: Template.Section,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  if (!section.blocks) return;
  const sectionHasLocalBlocks = await acceptsLocalBlocks(section.type, deps);
  if (sectionHasLocalBlocks) return;

  const promises: Promise<Void>[] = [];

  for (const [key, block] of Object.entries(section.blocks)) {
    const blockType = block.type;
    const blockModule = getThemeBlockModule(themeGraph, blockType);
    const path = [...nodePath, 'blocks', key];
    const node = nodeAtPath(sourceAst, path)! as ObjectNode;
    const typeProperty = node.children.find((child) => child.key.value === 'type')!;
    const start = typeProperty.loc.start.offset;
    const end = typeProperty.loc.end.offset;
    const sourceRange: Range = [start, end];
    // Link the template to the block
    bind(source, blockModule, { sourceRange });
    promises.push(
      // Traverse the block themselves
      traverseModule(blockModule, themeGraph, deps),
      // Traverse the block references
      traverseBlockReferences(source, sourceAst, path, block, themeGraph, deps),
    );
  }

  return Promise.all(promises);
}

async function traverseBlockReferences(
  source: ThemeModule, // template or section group
  sourceAst: JSONNode,
  nodePath: string[] = [],
  block: Template.Block,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  if (!block.blocks) return;

  const promises: Promise<Void>[] = [];
  for (const [key, childBlock] of Object.entries(block.blocks)) {
    const childBlockType = childBlock.type;
    const childBlockModule = getThemeBlockModule(themeGraph, childBlockType);
    const path = [...nodePath, 'blocks', key];
    const node = nodeAtPath(sourceAst, path)! as ObjectNode;
    const typeProperty = node.children.find((child) => child.key.value === 'type')!;
    const start = typeProperty.loc.start.offset;
    const end = typeProperty.loc.end.offset;
    const sourceRange: Range = [start, end];
    // Link the template/section group to the block
    bind(source, childBlockModule, { sourceRange });
    promises.push(
      // Traverse the child block themselves
      traverseModule(childBlockModule, themeGraph, deps),
      // Traverse the child block references
      traverseBlockReferences(source, sourceAst, path, childBlock, themeGraph, deps),
    );
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
export function bind(
  source: ThemeModule,
  target: ThemeModule,
  {
    sourceRange,
    targetRange,
    type = 'direct', // the type of dependency, can be 'direct', 'indirect' or 'preset'
  }: {
    sourceRange?: Range; // a range in the source module that references the child
    targetRange?: Range; // a range in the child module that is being referenced
    type?: Reference['type']; // the type of dependency
  } = {},
): void {
  const dependency: Reference = {
    source: { uri: source.uri, range: sourceRange },
    target: { uri: target.uri, range: targetRange },
    type: type,
  };

  source.dependencies.push(dependency);
  target.references.push(dependency);
}
