"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidObjectHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const TypeSystem_1 = require("../../TypeSystem");
const docset_1 = require("../../docset");
class LiquidObjectHoverProvider {
    constructor(typeSystem) {
        this.typeSystem = typeSystem;
    }
    async hover(currentNode, ancestors, params) {
        var _a;
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.VariableLookup &&
            currentNode.type !== liquid_html_parser_1.NodeTypes.AssignMarkup) {
            return null;
        }
        if (!currentNode.name) {
            return null;
        }
        let node = currentNode;
        if (node.type === liquid_html_parser_1.NodeTypes.VariableLookup) {
            node = {
                ...currentNode,
                lookups: [],
            };
        }
        const type = await this.typeSystem.inferType(node, ancestors[0], params.textDocument.uri);
        const objectMap = await this.typeSystem.objectMap(params.textDocument.uri, ancestors[0]);
        const entry = objectMap[(0, TypeSystem_1.isArrayType)(type) ? type.valueType : type];
        if (type === TypeSystem_1.Unknown) {
            return null;
        }
        if (!entry) {
            const entryByName = (_a = objectMap[currentNode.name]) !== null && _a !== void 0 ? _a : {};
            return {
                contents: {
                    kind: 'markdown',
                    value: (0, docset_1.render)({
                        ...entryByName,
                        name: currentNode.name,
                    }, type, 'object'),
                },
            };
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.render)({ ...entry, name: currentNode.name }, type, 'object'),
            },
        };
    }
}
exports.LiquidObjectHoverProvider = LiquidObjectHoverProvider;
//# sourceMappingURL=LiquidObjectHoverProvider.js.map