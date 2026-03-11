"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiquidObjectAttributeHoverProvider = void 0;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const TypeSystem_1 = require("../../TypeSystem");
const docset_1 = require("../../docset");
class LiquidObjectAttributeHoverProvider {
    constructor(typeSystem) {
        this.typeSystem = typeSystem;
    }
    async hover(currentNode, ancestors, params) {
        var _a, _b;
        const parentNode = ancestors.at(-1);
        const uri = params.textDocument.uri;
        if (currentNode.type !== liquid_html_parser_1.NodeTypes.String ||
            !parentNode ||
            parentNode.type !== liquid_html_parser_1.NodeTypes.VariableLookup ||
            !parentNode.lookups.includes(currentNode)) {
            return null;
        }
        const lookupIndex = parentNode.lookups.findIndex((lookup) => lookup === currentNode);
        const node = {
            ...parentNode,
            lookups: parentNode.lookups.slice(0, lookupIndex),
        };
        const objectMap = await this.typeSystem.objectMap(uri, ancestors[0]);
        const parentType = await this.typeSystem.inferType(node, ancestors[0], uri);
        if ((0, TypeSystem_1.isArrayType)(parentType) || parentType === 'string' || parentType === TypeSystem_1.Untyped) {
            const nodeType = await this.typeSystem.inferType({ ...parentNode, lookups: parentNode.lookups.slice(0, lookupIndex + 1) }, ancestors[0], uri);
            // 2D arrays and unknown types are not supported
            if ((0, TypeSystem_1.isArrayType)(nodeType) || nodeType === TypeSystem_1.Unknown)
                return null;
            // We want want `## first: `nodeType` with the docs of the nodeType
            const entry = { ...((_a = objectMap[nodeType]) !== null && _a !== void 0 ? _a : {}), name: currentNode.value };
            return {
                contents: {
                    kind: 'markdown',
                    value: (0, docset_1.render)(entry, nodeType),
                },
            };
        }
        const parentEntry = objectMap[parentType];
        if (!parentEntry) {
            return null;
        }
        const parentTypeProperties = ((_b = objectMap[parentType]) === null || _b === void 0 ? void 0 : _b.properties) || [];
        const entry = parentTypeProperties.find((p) => p.name === currentNode.value);
        if (!entry) {
            return null;
        }
        return {
            contents: {
                kind: 'markdown',
                value: (0, docset_1.render)(entry),
            },
        };
    }
}
exports.LiquidObjectAttributeHoverProvider = LiquidObjectAttributeHoverProvider;
//# sourceMappingURL=LiquidObjectAttributeHoverProvider.js.map