import { SupportLanguage, SupportOptions, version } from 'prettier';
import type { Plugin as Plugin2 } from 'prettier';
import type { Plugin as Plugin3 } from 'prettier3';
import { parsers, liquidHtmlLanguageName } from './parser';
import { printers2, printers3 } from './printer';
import { LiquidHtmlNode } from './types';

const languages: SupportLanguage[] = [
  {
    name: 'LiquidHTML',
    parsers: [liquidHtmlLanguageName],
    extensions: ['.liquid'],
    vscodeLanguageIds: ['liquid', 'Liquid'],
  },
];

const options: SupportOptions = {
  captureWhitespaceSensitivity: {
    type: 'choice',
    description: 'Specify the global whitespace sensitivity for the capture Liquid tag.',
    choices: [
      {
        value: 'strict',
        description: 'Whitespace inside {% capture var %} tags is considered significant.',
      },
      {
        value: 'ignore',
        description: 'Whitespace inside {% capture var %} tags is considered insignificant.',
      },
    ],
    category: 'LIQUID',
    default: 'strict',
    since: '1.5.0',
  },
  liquidSingleQuote: {
    type: 'boolean',
    category: 'LIQUID',
    default: true,
    description: 'Use single quotes instead of double quotes in Liquid tags and objects.',
    since: '0.2.0',
  },
  embeddedSingleQuote: {
    type: 'boolean',
    category: 'LIQUID',
    default: true,
    description:
      'Use single quotes instead of double quotes in embedded languages (JavaScript, CSS, TypeScript inside <script>, <style> or Liquid equivalent).',
    since: '0.4.0',
  },
  singleLineLinkTags: {
    type: 'boolean',
    category: 'HTML',
    default: false,
    description: 'Always print link tags on a single line to remove clutter',
    since: '0.1.0',
  },
  indentSchema: {
    type: 'boolean',
    category: 'LIQUID',
    default: false,
    description: 'Indent the contents of the {% schema %} tag',
    since: '0.1.0',
  },
  liquidDocParamDash: {
    type: 'boolean',
    category: 'LIQUID',
    default: true,
    description: 'Append a dash (-) to separate descriptions in {% doc %} @param annotations',
    since: '1.6.4',
  },
};

const defaultOptions = {
  printWidth: 120,
};

export const plugin2: Plugin2<LiquidHtmlNode> = {
  languages,
  parsers: parsers as Plugin2['parsers'],
  printers: printers2,
  options,
  defaultOptions,
};

export const plugin3: Plugin3<LiquidHtmlNode> = {
  languages,
  parsers: parsers as Plugin3['parsers'],
  printers: printers3 as any,
  options,
  defaultOptions,
};

const prettierMajor = version.split('.')[0]!;

export default prettierMajor === '2' ? plugin2 : plugin3;
