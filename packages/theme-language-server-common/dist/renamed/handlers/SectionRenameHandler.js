"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SectionRenameHandler = void 0;
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const documents_1 = require("../../documents");
const uri_1 = require("../../utils/uri");
const utils_1 = require("./utils");
const annotationId = 'renameSection';
/**
 * The SectionRenameHandler will handle section renames
 *
 * Whenever a section gets renamed, a lot of things need to happen:
 *   2. References in template files must be changed
 *   3. References in section groups must be changed
 *   4. References like {% section "oldName" %} must be changed
 */
class SectionRenameHandler {
    constructor(documentManager, connection, capabilities, findThemeRootURI) {
        this.documentManager = documentManager;
        this.connection = connection;
        this.capabilities = capabilities;
        this.findThemeRootURI = findThemeRootURI;
    }
    async onDidRenameFiles(params) {
        if (!this.capabilities.hasApplyEditSupport)
            return;
        const relevantRenames = params.files.filter((file) => (0, uri_1.isSection)(file.oldUri) && (0, uri_1.isSection)(file.newUri));
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
        const templates = theme.filter(documents_1.isJsonSourceCode).filter((file) => (0, uri_1.isTemplate)(file.uri));
        const sectionGroups = theme.filter(documents_1.isJsonSourceCode).filter((file) => (0, uri_1.isSectionGroup)(file.uri));
        const oldSectionName = (0, uri_1.sectionName)(rename.oldUri);
        const newSectionName = (0, uri_1.sectionName)(rename.newUri);
        const editLabel = `Rename section '${oldSectionName}' to '${newSectionName}'`;
        const workspaceEdit = {
            documentChanges: [],
            changeAnnotations: {
                [annotationId]: {
                    label: editLabel,
                    needsConfirmation: false,
                },
            },
        };
        // All the templates/*.json files need to be updated with the new block name
        // when the old block name wasn't a local block.
        const [templateChanges, sectionGroupChanges, sectionTagChanges] = await Promise.all([
            Promise.all(templates.map(this.getTemplateChanges(oldSectionName, newSectionName))),
            Promise.all(sectionGroups.map(this.getSectionGroupChanges(oldSectionName, newSectionName))),
            Promise.all(liquidFiles.map(this.getSectionTagChanges(oldSectionName, newSectionName))),
        ]);
        for (const docChange of [...templateChanges, ...sectionGroupChanges]) {
            if (docChange !== null) {
                workspaceEdit.documentChanges.push(docChange);
            }
        }
        // Because section tag changes could make a change to an existing document,
        // we need to group the edits together by document. Or else we might have
        // index drifting issues.
        for (const docChange of sectionTagChanges) {
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
    getTemplateChanges(oldSectionName, newSectionName) {
        return async (sourceCode) => {
            const { textDocument, ast, source } = sourceCode;
            const parsed = (0, theme_check_common_1.parseJSON)(source);
            if (!parsed || (0, theme_check_common_1.isError)(parsed) || (0, theme_check_common_1.isError)(ast))
                return null;
            const edits = !(0, utils_1.isValidTemplate)(parsed)
                ? []
                : Object.entries(parsed.sections)
                    .filter(([_key, section]) => section.type === oldSectionName)
                    .map(([key]) => {
                    const node = (0, theme_check_common_1.nodeAtPath)(ast, ['sections', key, 'type']);
                    return {
                        annotationId,
                        newText: newSectionName,
                        range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(node.loc.start.offset + 1), textDocument.positionAt(node.loc.end.offset - 1)),
                    };
                });
            if (edits.length === 0)
                return null;
            return documentChanges(sourceCode, edits);
        };
    }
    // Awfully similar except for the isValidSectionGroup check and the types of the objects.
    // Feels like a coincidence that the types are so similar. I'm not sure this should be DRY'd up.
    getSectionGroupChanges(oldSectionName, newSectionName) {
        return async (sourceCode) => {
            const { textDocument, ast, source } = sourceCode;
            const parsed = (0, theme_check_common_1.parseJSON)(source);
            if (!parsed || (0, theme_check_common_1.isError)(parsed) || (0, theme_check_common_1.isError)(ast))
                return null;
            const edits = !(0, utils_1.isValidSectionGroup)(parsed)
                ? []
                : Object.entries(parsed.sections)
                    .filter(([_key, section]) => section.type === oldSectionName)
                    .map(([key]) => {
                    const node = (0, theme_check_common_1.nodeAtPath)(ast, ['sections', key, 'type']);
                    return {
                        annotationId,
                        newText: newSectionName,
                        range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(node.loc.start.offset + 1), textDocument.positionAt(node.loc.end.offset - 1)),
                    };
                });
            if (edits.length === 0)
                return null;
            return documentChanges(sourceCode, edits);
        };
    }
    getSectionTagChanges(oldSectionName, newSectionName) {
        return async (sourceCode) => {
            const { textDocument, ast } = sourceCode;
            if ((0, theme_check_common_1.isError)(ast))
                return null;
            const edits = (0, theme_check_common_1.visit)(ast, {
                LiquidTag(node) {
                    if (node.name !== 'section')
                        return;
                    if (typeof node.markup === 'string')
                        return;
                    // Note the type assertion to the LHS of the expression.
                    // The type assertions above are enough for this to be true.
                    // But I'm making the explicit annotation here to make it clear.
                    const typeNode = node.markup;
                    if (typeNode.value !== oldSectionName)
                        return;
                    return {
                        annotationId,
                        newText: newSectionName,
                        range: vscode_languageserver_protocol_1.Range.create(textDocument.positionAt(typeNode.position.start + 1), textDocument.positionAt(typeNode.position.end - 1)),
                    };
                },
            });
            if (edits.length === 0)
                return null;
            return documentChanges(sourceCode, edits);
        };
    }
}
exports.SectionRenameHandler = SectionRenameHandler;
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
//# sourceMappingURL=SectionRenameHandler.js.map