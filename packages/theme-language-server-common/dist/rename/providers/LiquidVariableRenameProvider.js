"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidVariableRenameProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const theme_check_common_1 = require("@shopify/theme-check-common");
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const documents_1 = require("../../documents");
const uri_1 = require("../../utils/uri");
class LiquidVariableRenameProvider {
    constructor(connection, clientCapabilities, documentManager, findThemeRootURI) {
        this.connection = connection;
        this.clientCapabilities = clientCapabilities;
        this.documentManager = documentManager;
        this.findThemeRootURI = findThemeRootURI;
    }
    async prepare(node, ancestors, params) {
        const document = this.documentManager.get(params.textDocument.uri);
        const textDocument = document === null || document === void 0 ? void 0 : document.textDocument;
        if (!textDocument || !node || !ancestors)
            return null;
        if (!supportedTags(node, ancestors))
            return null;
        const targetNode = node.type === liquid_html_parser_1.NodeTypes.LiquidDocParamNode ? node.paramName : node;
        const oldName = variableName(node);
        const cursorOffset = textDocument.offsetAt(params.position);
        const offsetOfVariableNameEnd = targetNode.position.start + oldName.length;
        // The cursor must be within the variable name range
        if (cursorOffset < targetNode.position.start || cursorOffset > offsetOfVariableNameEnd)
            return null;
        return {
            range: vscode_languageserver_1.Range.create(textDocument.positionAt(targetNode.position.start), textDocument.positionAt(offsetOfVariableNameEnd)),
            placeholder: oldName,
        };
    }
    async rename(node, ancestors, params) {
        const document = this.documentManager.get(params.textDocument.uri);
        const rootUri = await this.findThemeRootURI(params.textDocument.uri);
        const textDocument = document === null || document === void 0 ? void 0 : document.textDocument;
        if (!rootUri || !textDocument || !node || !ancestors)
            return null;
        if (document.ast instanceof Error)
            return null;
        if (!supportedTags(node, ancestors))
            return null;
        // When node is a LiquidDocParamNode, ensure cursor is on the param name, not the @param keyword or type annotation
        if (node.type === liquid_html_parser_1.NodeTypes.LiquidDocParamNode) {
            const cursorOffset = textDocument.offsetAt(params.position);
            const nameEnd = node.paramName.position.start + node.paramName.value.length;
            if (cursorOffset < node.paramName.position.start || cursorOffset > nameEnd)
                return null;
        }
        const oldName = variableName(node);
        const scope = variableNameBlockScope(oldName, ancestors);
        const replaceRange = textReplaceRange(oldName, textDocument, scope);
        let liquidDocParamUpdated = false;
        const ranges = (0, theme_check_common_1.visit)(document.ast, {
            VariableLookup: replaceRange,
            AssignMarkup: replaceRange,
            ForMarkup: replaceRange,
            TextNode: (node, ancestors) => {
                const parentNode = ancestors.at(-1);
                if ((parentNode === null || parentNode === void 0 ? void 0 : parentNode.type) !== liquid_html_parser_1.NodeTypes.LiquidDocParamNode || (parentNode === null || parentNode === void 0 ? void 0 : parentNode.paramName) !== node)
                    return;
                liquidDocParamUpdated = true;
                return replaceRange(node, ancestors);
            },
        });
        if (this.clientCapabilities.hasApplyEditSupport && liquidDocParamUpdated) {
            const themeFiles = this.documentManager.theme(rootUri, true);
            const liquidSourceCodes = themeFiles.filter(documents_1.isLiquidSourceCode);
            const name = (0, uri_1.snippetName)(params.textDocument.uri);
            updateRenderTags(this.connection, liquidSourceCodes, name, oldName, params.newName);
        }
        const textDocumentEdit = vscode_languageserver_protocol_1.TextDocumentEdit.create({ uri: textDocument.uri, version: textDocument.version }, ranges.map((range) => vscode_languageserver_protocol_1.TextEdit.replace(range, params.newName)));
        return {
            documentChanges: [textDocumentEdit],
        };
    }
}
exports.LiquidVariableRenameProvider = LiquidVariableRenameProvider;
function supportedTags(node, ancestors) {
    return (node.type === liquid_html_parser_1.NodeTypes.AssignMarkup ||
        node.type === liquid_html_parser_1.NodeTypes.VariableLookup ||
        node.type === liquid_html_parser_1.NodeTypes.ForMarkup ||
        isLiquidDocParamNameNode(node, ancestors) ||
        isLiquidDocParamNode(node));
}
function isLiquidDocParamNameNode(node, ancestors) {
    const parentNode = ancestors.at(-1);
    return (!!parentNode &&
        parentNode.type === liquid_html_parser_1.NodeTypes.LiquidDocParamNode &&
        parentNode.paramName === node &&
        node.type === liquid_html_parser_1.NodeTypes.TextNode);
}
function isLiquidDocParamNode(node) {
    var _a;
    return node.type === liquid_html_parser_1.NodeTypes.LiquidDocParamNode && ((_a = node.paramName) === null || _a === void 0 ? void 0 : _a.type) === liquid_html_parser_1.NodeTypes.TextNode;
}
function variableName(node) {
    var _a, _b;
    switch (node.type) {
        case liquid_html_parser_1.NodeTypes.VariableLookup:
        case liquid_html_parser_1.NodeTypes.AssignMarkup:
            return (_a = node.name) !== null && _a !== void 0 ? _a : '';
        case liquid_html_parser_1.NodeTypes.ForMarkup:
            return (_b = node.variableName) !== null && _b !== void 0 ? _b : '';
        case liquid_html_parser_1.NodeTypes.TextNode:
            return node.value;
        case liquid_html_parser_1.NodeTypes.LiquidDocParamNode:
            return node.paramName.value;
        default:
            return '';
    }
}
/*
 * Find the scope where the variable name is used. Looks at defined in `tablerow` and `for` tags.
 */
function variableNameBlockScope(variableName, ancestors) {
    let scopedAncestor;
    for (let i = ancestors.length - 1; i >= 0; i--) {
        const ancestor = ancestors[i];
        if (ancestor.type === liquid_html_parser_1.NodeTypes.LiquidTag &&
            (ancestor.name === liquid_html_parser_1.NamedTags.tablerow || ancestor.name === liquid_html_parser_1.NamedTags.for) &&
            typeof ancestor.markup !== 'string' &&
            ancestor.markup.variableName === variableName) {
            scopedAncestor = ancestor;
            break;
        }
    }
    if (!scopedAncestor || !scopedAncestor.blockEndPosition)
        return;
    return {
        start: scopedAncestor.blockStartPosition.start,
        end: scopedAncestor.blockEndPosition.end,
    };
}
function textReplaceRange(oldName, textDocument, selectedVariableScope) {
    return (node, ancestors) => {
        if (variableName(node) !== oldName)
            return;
        const ancestorScope = variableNameBlockScope(oldName, ancestors);
        if ((ancestorScope === null || ancestorScope === void 0 ? void 0 : ancestorScope.start) !== (selectedVariableScope === null || selectedVariableScope === void 0 ? void 0 : selectedVariableScope.start) ||
            (ancestorScope === null || ancestorScope === void 0 ? void 0 : ancestorScope.end) !== (selectedVariableScope === null || selectedVariableScope === void 0 ? void 0 : selectedVariableScope.end)) {
            return;
        }
        return vscode_languageserver_1.Range.create(textDocument.positionAt(node.position.start), textDocument.positionAt(node.position.start + oldName.length));
    };
}
async function updateRenderTags(connection, liquidSourceCodes, snippetName, oldParamName, newParamName) {
    var _a;
    const editLabel = `Rename snippet parameter '${oldParamName}' to '${newParamName}'`;
    const annotationId = 'renameSnippetParameter';
    const workspaceEdit = {
        documentChanges: [],
        changeAnnotations: {
            [annotationId]: {
                label: editLabel,
                needsConfirmation: false,
            },
        },
    };
    for (const sourceCode of liquidSourceCodes) {
        if (sourceCode.ast instanceof Error)
            continue;
        const textDocument = sourceCode.textDocument;
        const edits = (0, theme_check_common_1.visit)(sourceCode.ast, {
            RenderMarkup(node) {
                var _a;
                if (node.snippet.type !== liquid_html_parser_1.NodeTypes.String || node.snippet.value !== snippetName) {
                    return;
                }
                const renamedNameParamNode = node.args.find((arg) => arg.name === oldParamName);
                if (renamedNameParamNode) {
                    return {
                        newText: `${newParamName}: `,
                        range: vscode_languageserver_1.Range.create(textDocument.positionAt(renamedNameParamNode.position.start), textDocument.positionAt(renamedNameParamNode.value.position.start)),
                    };
                }
                if (((_a = node.alias) === null || _a === void 0 ? void 0 : _a.value) === oldParamName && node.variable) {
                    // `as variable` is not captured in our liquid parser yet,
                    // so we have to check it manually and replace it
                    const aliasMatch = /as\s+([^\s,]+)/g;
                    const match = aliasMatch.exec(node.source.slice(node.position.start, node.position.end));
                    if (!match)
                        return;
                    return {
                        newText: `as ${newParamName}`,
                        range: vscode_languageserver_1.Range.create(textDocument.positionAt(node.position.start + match.index), textDocument.positionAt(node.position.start + match.index + match[0].length)),
                    };
                }
            },
        });
        if (edits.length === 0)
            continue;
        workspaceEdit.documentChanges.push({
            textDocument: {
                uri: textDocument.uri,
                version: (_a = sourceCode.version) !== null && _a !== void 0 ? _a : null /* null means file from disk in this API */,
            },
            annotationId,
            edits,
        });
    }
    if (workspaceEdit.documentChanges.length === 0) {
        console.error('Nothing to do!');
        return;
    }
    await connection.sendRequest(vscode_languageserver_protocol_1.ApplyWorkspaceEditRequest.type, {
        label: editLabel,
        edit: workspaceEdit,
    });
}
//# sourceMappingURL=LiquidVariableRenameProvider.js.map