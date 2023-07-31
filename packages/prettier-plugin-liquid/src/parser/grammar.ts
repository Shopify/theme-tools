import ohm from 'ohm-js';

export const liquidHtmlGrammars = ohm.grammars(
  require('../../grammar/liquid-html.ohm.js'),
);

export interface LiquidGrammars {
  Liquid: ohm.Grammar;
  LiquidHTML: ohm.Grammar;
  LiquidStatement: ohm.Grammar;
}

export const strictGrammars: LiquidGrammars = {
  Liquid: liquidHtmlGrammars['StrictLiquid'],
  LiquidHTML: liquidHtmlGrammars['StrictLiquidHTML'],
  LiquidStatement: liquidHtmlGrammars['StrictLiquidStatement'],
};

export const tolerantGrammars: LiquidGrammars = {
  Liquid: liquidHtmlGrammars['Liquid'],
  LiquidHTML: liquidHtmlGrammars['LiquidHTML'],
  LiquidStatement: liquidHtmlGrammars['LiquidStatement'],
};

export const placeholderGrammars: LiquidGrammars = {
  Liquid: liquidHtmlGrammars['WithPlaceholderLiquid'],
  LiquidHTML: liquidHtmlGrammars['WithPlaceholderLiquidHTML'],
  LiquidStatement: liquidHtmlGrammars['WithPlaceholderLiquidStatement'],
};

// see ../../grammar/liquid-html.ohm for full list
export const BLOCKS = (
  strictGrammars.LiquidHTML.rules as any
).blockName.body.factors[0].terms.map((x: any) => x.obj) as string[];

// see ../../grammar/liquid-html.ohm for full list
export const RAW_TAGS = (
  strictGrammars.LiquidHTML.rules as any
).liquidRawTag.body.terms
  .map((term: any) => term.args[0].obj)
  .concat('comment') as string[];

// see ../../grammar/liquid-html.ohm for full list
export const VOID_ELEMENTS = (
  strictGrammars.LiquidHTML.rules as any
).voidElementName.body.factors[0].terms.map(
  (x: any) => x.args[0].obj,
) as string[];

export const TAGS_WITHOUT_MARKUP = [
  'style',
  'schema',
  'javascript',
  'else',
  'break',
  'continue',
  'comment',
  'raw',
];
