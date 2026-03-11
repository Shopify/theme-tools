"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAGS_WITHOUT_MARKUP = exports.VOID_ELEMENTS = exports.RAW_TAGS = exports.BLOCKS = exports.placeholderGrammars = exports.tolerantGrammars = exports.strictGrammars = exports.LiquidDocGrammar = exports.TextNodeGrammar = exports.liquidHtmlGrammars = void 0;
const ohm_js_1 = require("ohm-js");
exports.liquidHtmlGrammars = (0, ohm_js_1.grammars)(require('../grammar/liquid-html.ohm.js'));
exports.TextNodeGrammar = exports.liquidHtmlGrammars['Helpers'];
exports.LiquidDocGrammar = exports.liquidHtmlGrammars['LiquidDoc'];
exports.strictGrammars = {
    Liquid: exports.liquidHtmlGrammars['StrictLiquid'],
    LiquidHTML: exports.liquidHtmlGrammars['StrictLiquidHTML'],
    LiquidStatement: exports.liquidHtmlGrammars['StrictLiquidStatement'],
};
exports.tolerantGrammars = {
    Liquid: exports.liquidHtmlGrammars['Liquid'],
    LiquidHTML: exports.liquidHtmlGrammars['LiquidHTML'],
    LiquidStatement: exports.liquidHtmlGrammars['LiquidStatement'],
};
exports.placeholderGrammars = {
    Liquid: exports.liquidHtmlGrammars['WithPlaceholderLiquid'],
    LiquidHTML: exports.liquidHtmlGrammars['WithPlaceholderLiquidHTML'],
    LiquidStatement: exports.liquidHtmlGrammars['WithPlaceholderLiquidStatement'],
};
// see ../../grammar/liquid-html.ohm for full list
exports.BLOCKS = exports.strictGrammars.LiquidHTML.rules.blockName.body.factors[0].terms.map((x) => x.obj);
// see ../../grammar/liquid-html.ohm for full list
exports.RAW_TAGS = exports.strictGrammars.LiquidHTML.rules.liquidRawTag.body.terms
    .map((term) => term.args[0].obj)
    .concat('comment');
// see ../../grammar/liquid-html.ohm for full list
exports.VOID_ELEMENTS = exports.strictGrammars.LiquidHTML.rules.voidElementName.body.factors[0].terms.map((x) => x.args[0].obj);
exports.TAGS_WITHOUT_MARKUP = [
    'style',
    'schema',
    'javascript',
    'else',
    'break',
    'continue',
    'comment',
    'raw',
    'doc',
];
//# sourceMappingURL=grammar.js.map