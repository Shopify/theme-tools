"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockRenameHandler = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const documents_1 = require("../../documents");
const uri_1 = require("../../utils/uri");
const utils_1 = require("./utils");
const annotationId = 'renameBlock';
/**
 * The BlockRenameHandler will handle block renames.
 *
 * Whenever a block gets renamed, a lot of things need to happen:
 *   1. References in files with a {% schema %} must be changed
 *   2. References in template files must be changed
 *   3. References in section groups must be changed
 *   4. References in {% content_for "block", type: "oldName" %} must be changed
 *
 * Things we're not doing:
 *   5. If isPublic(oldName) && isPrivate(newName) && "schema.blocks" accepts "@theme",
 *      Then the block should be added to the "blocks" array
 *
 *    Reasoning: this is more noisy than useful. a now-private block
 *      could be used by a preset, template or section group. Doing a
 *      toil-free rename would require visiting all preset, templates and
 *      section groups to see if a parent that uses the new block name
 *      was supporting "@theme" blocks. It's a lot. It's O(S*(S+T+SG)) where
 *      S is the number of sections, T is the number of templates and SG is the
 *      number of section groups. It's not worth it.
 *
 *      This stuff is complicated enough as it is 😅.
 */
class BlockRenameHandler {
    constructor(documentManager, connection, capabilities, findThemeRootURI) {
        this.documentManager = documentManager;
        this.connection = connection;
        this.capabilities = capabilities;
        this.findThemeRootURI = findThemeRootURI;
    }
    async onDidRenameFiles(params) {
        if (!this.capabilities.hasApplyEditSupport)
            return;
        const relevantRenames = params.files.filter((file) => (0, uri_1.isBlock)(file.oldUri) && (0, uri_1.isBlock)(file.newUri));
        // Only preload if you have something to do (folder renames not supported yet).
        if (relevantRenames.length !== 1)
            return;
        const rename = relevantRenames[0];
        const rootUri = await this.findThemeRootURI(theme_check_common_1.path.dirname(params.files[0].oldUri));
        if (!rootUri)
            return;
        await this.documentManager.preload(rootUri);
        const theme = this.documentManager.theme(rootUri, true);
        const liquidFiles = theme.filter(documents_1.isLiquidSourceCode);
        const sectionsAndBlocks = liquidFiles.filter((file) => (0, uri_1.isBlock)(file.uri) || (0, uri_1.isSection)(file.uri));
        const templates = theme.filter(documents_1.isJsonSourceCode).filter((file) => (0, uri_1.isTemplate)(file.uri));
        const sectionGroups = theme.filter(documents_1.isJsonSourceCode).filter((file) => (0, uri_1.isSectionGroup)(file.uri));
        const oldBlockName = (0, uri_1.blockName)(rename.oldUri);
        const newBlockName = (0, uri_1.blockName)(rename.newUri);
        const editLabel = `Rename block '${oldBlockName}' to '${newBlockName}'`;
        const workspaceEdit = {
            documentChanges: [],
            changeAnnotations: {
                [annotationId]: {
                    label: editLabel,
                    needsConfirmation: false,
                },
            },
        };
        // We need to keep track of sections that have local blocks, because we
        // shouldn't rename those. Only uses of "@theme" or specifically named blocks
        // should be renamed when the blocks/*.liquid file is renamed.
        const sectionsWithLocalBlocks = new Set();
        const sectionAndBlocksChanges = await Promise.all(sectionsAndBlocks.map(this.getSchemaChanges(sectionsWithLocalBlocks, oldBlockName, newBlockName)));
        // All the templates/*.json files need to be updated with the new block name
        // when the old block name wasn't a local block.
        const [templateChanges, sectionGroupChanges, contentForChanges] = await Promise.all([
            Promise.all(templates.map(this.getTemplateChanges(oldBlockName, newBlockName, sectionsWithLocalBlocks))),
            Promise.all(sectionGroups.map(this.getSectionGroupChanges(oldBlockName, newBlockName, sectionsWithLocalBlocks))),
            Promise.all(liquidFiles.map(this.getContentForChanges(oldBlockName, newBlockName))),
        ]);
        for (const docChange of [
            ...sectionAndBlocksChanges,
            ...templateChanges,
            ...sectionGroupChanges,
        ]) {
            if (docChange !== null) {
                workspaceEdit.documentChanges.push(docChange);
            }
        }
        // Because contentForChanges could make a change to an existing document, we need
        // to group the edits together by document. Or else we might have index
        // drifting issues.
        for (const docChange of contentForChanges) {
            if (docChange !== null) {
                const existingDocChange = workspaceEdit.documentChanges.find((dc) => dc.textDocument.uri === (docChange === null || docChange === void 0 ? void 0 : docChange.textDocument.uri));
                if (existingDocChange) {
                    existingDocChange.edits.push(...docChange.edits);
                }
                else {
                    workspaceEdit.documentChanges.push(docChange);
                }
            }
        }
        if (workspaceEdit.documentChanges.length === 0) {
            console.error('Nothing to do!');
            return;
        }
        await this.connection.sendRequest(vscode_languageserver_protocol_1.ApplyWorkspaceEditRequest.type, {
            label: editLabel,
            edit: workspaceEdit,
        });
    }
    getSchemaChanges(sectionsWithLocalBlocks, oldBlockName, newBlockName) {
        return async (sourceCode) => {
            if (sourceCode.ast instanceof Error)
                return null;
            const textDocument = sourceCode.textDocument;
            const schema = await sourceCode.getSchema();
            if (!(0, theme_check_common_1.isBlockSchema)(schema) && !(0, theme_check_common_1.isSectionSchema)(schema))
                return null;
            if ((0, theme_check_common_1.isError)(schema.validSchema) || (0, theme_check_common_1.isError)(schema.ast))
                return null;
            const { validSchema, ast, offset } = schema;
            const edits = [];
            if (validSchema.blocks) {
                for (let i = 0; i < validSchema.blocks.length; i++) {
                    const blockDef = validSchema.blocks[i];
                    if (isLocalBlock(blockDef)) {
                        // If the section has a local blocks, we shouldn't rename
                        // anything in this file.
                        if ((0, theme_check_common_1.isSectionSchema)(schema)) {
                            sectionsWithLocalBlocks.add(schema.name);
                        }
                        return null;
                    }
                    if (blockDef.type !== oldBlockName)
                        continue;
                    const node = (0, theme_check_common_1.nodeAtPath)(ast, ['blocks', i, 'type']);
                    edits.push({
                        annotationId,
                        newText: newBlockName,
                        range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(offset + node.loc.start.offset + 1), textDocument.positionAt(offset + node.loc.end.offset - 1)),
                    });
                }
            }
            const presetEdits = (presetBlock, path) => {
                if (!presetBlock || !('blocks' in presetBlock))
                    return [];
                if (Array.isArray(presetBlock.blocks)) {
                    return presetBlock.blocks.flatMap((block, index) => {
                        const edits = presetEdits(block, [...path, 'blocks', index]);
                        if (block.type === oldBlockName) {
                            const node = (0, theme_check_common_1.nodeAtPath)(ast, [...path, 'blocks', index, 'type']);
                            edits.push({
                                annotationId,
                                newText: newBlockName,
                                range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(offset + node.loc.start.offset + 1), textDocument.positionAt(offset + node.loc.end.offset - 1)),
                            });
                        }
                        return edits;
                    });
                }
                else if (typeof presetBlock.blocks === 'object') {
                    return Object.entries(presetBlock.blocks).flatMap(([key, block]) => {
                        const edits = presetEdits(block, [...path, 'blocks', key]);
                        if (block.type === oldBlockName) {
                            const node = (0, theme_check_common_1.nodeAtPath)(ast, [...path, 'blocks', key, 'type']);
                            edits.push({
                                annotationId,
                                newText: newBlockName,
                                range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(offset + node.loc.start.offset + 1), textDocument.positionAt(offset + node.loc.end.offset - 1)),
                            });
                        }
                        return edits;
                    });
                }
                else {
                    return [];
                }
            };
            if (validSchema.presets) {
                edits.push(...validSchema.presets.flatMap((preset, i) => presetEdits(preset, ['presets', i])));
            }
            if (edits.length === 0)
                return null;
            return documentChanges(sourceCode, edits);
        };
    }
    getTemplateChanges(oldBlockName, newBlockName, sectionsWithLocalBlocks) {
        return async (sourceCode) => {
            // assuming that the JSON is valid...
            const { textDocument, ast, source } = sourceCode;
            const parsed = (0, theme_check_common_1.parseJSON)(source);
            if (!parsed || (0, theme_check_common_1.isError)(parsed) || (0, theme_check_common_1.isError)(ast))
                return null;
            const getBlocksEdits = getBlocksEditsFactory(oldBlockName, newBlockName, textDocument, ast);
            const edits = !(0, utils_1.isValidTemplate)(parsed)
                ? []
                : Object.entries(parsed.sections).flatMap(([key, section]) => {
                    if ('blocks' in section &&
                        !!section.blocks &&
                        !sectionsWithLocalBlocks.has(section.type) // don't rename local blocks
                    ) {
                        return getBlocksEdits(section.blocks, ['sections', key, 'blocks']);
                    }
                    else {
                        return [];
                    }
                });
            if (edits.length === 0)
                return null;
            return documentChanges(sourceCode, edits);
        };
    }
    getSectionGroupChanges(oldBlockName, newBlockName, sectionsWithLocalBlocks) {
        return async (sourceCode) => {
            const { textDocument, ast, source } = sourceCode;
            const parsed = (0, theme_check_common_1.parseJSON)(source);
            if (!parsed || (0, theme_check_common_1.isError)(parsed) || (0, theme_check_common_1.isError)(ast))
                return null;
            const getBlocksEdits = getBlocksEditsFactory(oldBlockName, newBlockName, textDocument, ast);
            const edits = !(0, utils_1.isValidSectionGroup)(parsed)
                ? []
                : Object.entries(parsed.sections).flatMap(([key, section]) => {
                    if ('blocks' in section &&
                        !!section.blocks &&
                        !sectionsWithLocalBlocks.has(section.type) // don't rename local blocks
                    ) {
                        return getBlocksEdits(section.blocks, ['sections', key, 'blocks']);
                    }
                    else {
                        return [];
                    }
                });
            if (edits.length === 0)
                return null;
            return documentChanges(sourceCode, edits);
        };
    }
    getContentForChanges(oldBlockName, newBlockName) {
        return async (sourceCode) => {
            const { textDocument, ast } = sourceCode;
            if ((0, theme_check_common_1.isError)(ast))
                return null;
            const edits = (0, theme_check_common_1.visit)(ast, {
                LiquidTag(node) {
                    if (node.name !== 'content_for')
                        return;
                    if (typeof node.markup === 'string')
                        return;
                    if (node.markup.contentForType.value !== 'block')
                        return;
                    const typeNode = node.markup.args.find((arg) => arg.name === 'type');
                    if (!typeNode ||
                        typeNode.value.type !== liquid_html_parser_1.NodeTypes.String ||
                        typeNode.value.value !== oldBlockName) {
                        return;
                    }
                    return {
                        annotationId,
                        newText: newBlockName,
                        range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(typeNode.value.position.start + 1), textDocument.positionAt(typeNode.value.position.end - 1)),
                    };
                },
            });
            if (edits.length === 0)
                return null;
            return documentChanges(sourceCode, edits);
        };
    }
}
exports.BlockRenameHandler = BlockRenameHandler;
function isLocalBlock(blockDef) {
    return 'name' in blockDef && typeof blockDef.name === 'string';
}
function getBlocksEditsFactory(oldBlockName, newBlockName, textDocument, ast) {
    return function getBlocksEdits(blocks, path) {
        if (!blocks)
            return [];
        return Object.entries(blocks).flatMap(([key, block]) => {
            const edits = getBlocksEdits(block.blocks, [...path, key, 'blocks']);
            if (block.type === oldBlockName) {
                const node = (0, theme_check_common_1.nodeAtPath)(ast, [...path, key, 'type']);
                edits.push({
                    annotationId,
                    newText: newBlockName,
                    range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(node.loc.start.offset + 1), textDocument.positionAt(node.loc.end.offset - 1)),
                });
            }
            return edits;
        });
    };
}
function documentChanges(sourceCode, edits) {
    var _a;
    return {
        textDocument: {
            uri: sourceCode.uri,
            version: (_a = sourceCode.version) !== null && _a !== void 0 ? _a : null /* null means file from disk in this API */,
        },
        edits,
    };
}
//# sourceMappingURL=BlockRenameHandler.js.map