"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSchema = toSchema;
exports.isBlock = isBlock;
exports.isSection = isSection;
exports.isSnippet = isSnippet;
exports.isBlockSchema = isBlockSchema;
exports.isSectionSchema = isSectionSchema;
exports.toBlockSchema = toBlockSchema;
exports.toSectionSchema = toSectionSchema;
exports.toAppBlockSchema = toAppBlockSchema;
exports.getSchema = getSchema;
exports.getSchemaFromJSON = getSchemaFromJSON;
const liquid_html_parser_1 = require("@shopify/liquid-html-parser");
const json_1 = require("./json");
const path = __importStar(require("./path"));
const to_source_code_1 = require("./to-source-code");
const types_1 = require("./types");
const visitor_1 = require("./visitor");
async function toSchema(mode, uri, sourceCode, isValidSchema, isStrict = true) {
    if (sourceCode.type !== types_1.SourceCodeType.LiquidHtml)
        return undefined;
    switch (true) {
        case mode === 'app' && isBlock(uri):
            return toAppBlockSchema(uri, sourceCode.ast, isStrict);
        case mode === 'theme' && isBlock(uri):
            return toBlockSchema(uri, sourceCode.ast, isValidSchema, isStrict);
        case mode === 'theme' && isSection(uri):
            return toSectionSchema(uri, sourceCode.ast, isValidSchema, isStrict);
        default:
            return undefined;
    }
}
function isBlock(uri) {
    return path.dirname(uri).endsWith('blocks');
}
function isSection(uri) {
    return path.dirname(uri).endsWith('sections');
}
function isSnippet(uri) {
    return path.dirname(uri).endsWith('snippets');
}
function isBlockSchema(schema) {
    return (schema === null || schema === void 0 ? void 0 : schema.type) === types_1.ThemeSchemaType.Block;
}
function isSectionSchema(schema) {
    return (schema === null || schema === void 0 ? void 0 : schema.type) === types_1.ThemeSchemaType.Section;
}
async function toValidSchema(uri, schemaNode, parsed, isValidSchema) {
    if (!isValidSchema)
        return new Error('No JSON validator provided');
    if (schemaNode instanceof Error)
        return parsed;
    if (await isValidSchema(uri, schemaNode.body.value)) {
        return parsed;
    }
    else {
        return new Error('Invalid schema');
    }
}
async function toBlockSchema(uri, liquidAst, isValidSchema, isStrict) {
    const name = path.basename(uri, '.liquid');
    const schemaNode = toSchemaNode(liquidAst);
    const staticBlockDefs = toStaticBlockDefs(liquidAst);
    const parsed = toParsed(schemaNode, isStrict);
    const ast = toAst(schemaNode);
    return {
        type: types_1.ThemeSchemaType.Block,
        validSchema: await toValidSchema(uri, schemaNode, parsed, isValidSchema),
        offset: schemaNode instanceof Error ? 0 : schemaNode.blockStartPosition.end,
        name,
        parsed,
        ast,
        value: schemaNode instanceof Error ? '' : schemaNode.body.value,
        staticBlockDefs,
    };
}
// Coincidentally very similar right now... but could be different in the future
// given there might be a plan to support folders in the blocks folder.
// e.g. if we start having a stricter "parsed" object / ways to get settings.
async function toSectionSchema(uri, liquidAst, isValidSchema, isStrict) {
    const name = path.basename(uri, '.liquid');
    const schemaNode = toSchemaNode(liquidAst);
    const staticBlockDefs = toStaticBlockDefs(liquidAst);
    const parsed = toParsed(schemaNode, isStrict);
    const ast = toAst(schemaNode);
    return {
        type: types_1.ThemeSchemaType.Section,
        validSchema: await toValidSchema(uri, schemaNode, parsed, isValidSchema),
        offset: schemaNode instanceof Error ? 0 : schemaNode.blockStartPosition.end,
        name,
        parsed,
        ast,
        value: schemaNode instanceof Error ? '' : schemaNode.body.value,
        staticBlockDefs,
    };
}
// validSchema not implemented yet. You can still `visit` the ast.
async function toAppBlockSchema(uri, liquidAst, isStrict) {
    const name = path.basename(uri, '.liquid');
    const schemaNode = toSchemaNode(liquidAst);
    const parsed = toParsed(schemaNode, isStrict);
    const ast = toAst(schemaNode);
    return {
        type: types_1.ThemeSchemaType.AppBlock,
        offset: schemaNode instanceof Error ? 0 : schemaNode.blockStartPosition.end,
        name,
        parsed,
        ast,
        value: schemaNode instanceof Error ? '' : schemaNode.body.value,
    };
}
function toSchemaNode(ast) {
    var _a;
    if (ast instanceof Error)
        return ast;
    return ((_a = (0, visitor_1.visit)(ast, {
        LiquidRawTag(node) {
            if (node.name === 'schema') {
                return node;
            }
        },
    })[0]) !== null && _a !== void 0 ? _a : new Error('No schema tag found'));
}
function toStaticBlockDefs(ast) {
    if (ast instanceof Error)
        return [];
    return (0, visitor_1.visit)(ast, {
        LiquidTag(node) {
            if (node.name !== liquid_html_parser_1.NamedTags.content_for)
                return;
            if (typeof node.markup === 'string')
                return;
            const contentForMarkup = node.markup;
            if (contentForMarkup.contentForType.value !== 'block')
                return;
            const type = contentForMarkup.args.find((x) => x.name === 'type');
            const id = contentForMarkup.args.find((x) => x.name === 'id');
            if (!type || !id)
                return;
            if (type.value.type !== liquid_html_parser_1.NodeTypes.String)
                return;
            if (id.value.type !== liquid_html_parser_1.NodeTypes.String)
                return;
            return {
                type: type.value.value,
                id: id.value.value,
            };
        },
    });
}
function getSchema(context) {
    var _a, _b;
    const name = path.basename(context.file.uri, '.liquid');
    switch (true) {
        case isBlock(context.file.uri):
            return (_a = context.getBlockSchema) === null || _a === void 0 ? void 0 : _a.call(context, name);
        case isSection(context.file.uri):
            return (_b = context.getSectionSchema) === null || _b === void 0 ? void 0 : _b.call(context, name);
        default:
            return undefined;
    }
}
async function getSchemaFromJSON(context) {
    const originalSource = context.file.source;
    const parsed = (0, json_1.parseJSON)(originalSource);
    const ast = (0, to_source_code_1.toJSONAST)(originalSource);
    return {
        parsed,
        ast,
    };
}
function toParsed(schemaNode, isStrict) {
    if (schemaNode instanceof Error)
        return schemaNode;
    return (0, json_1.parseJSON)(schemaNode.body.value, undefined, isStrict);
}
function toAst(schemaNode) {
    if (schemaNode instanceof Error)
        return schemaNode;
    return (0, to_source_code_1.toJSONAST)(schemaNode.body.value);
}
//# sourceMappingURL=to-schema.js.map