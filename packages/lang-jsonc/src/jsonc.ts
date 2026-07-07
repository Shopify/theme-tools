import {
  continuedIndent,
  foldInside,
  foldNodeProp,
  indentNodeProp,
  LanguageSupport,
  LRLanguage,
} from '@codemirror/language';
import { parser } from './parser';

/// A language provider that provides JSON parsing.
export const jsoncLanguage = LRLanguage.define({
  name: 'jsonc',
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        Object: continuedIndent({ except: /^\s*\}/ }),
        Array: continuedIndent({ except: /^\s*\]/ }),
      }),
      foldNodeProp.add({
        'Object Array': foldInside,
      }),
    ],
  }),
  languageData: {
    closeBrackets: { brackets: ['[', '{', '"'] },
    indentOnInput: /^\s*[\}\]]$/,
  },
});

export function jsonc() {
  return new LanguageSupport(jsoncLanguage);
}
