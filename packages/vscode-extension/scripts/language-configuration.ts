import { LanguageConfiguration } from 'vscode';
import { indentationRules, IndentationRulesJSON } from './indentation-rules';
import { onEnterRules, OnEnterRuleJSON } from './on-enter-actions';

// interface LanguageConfigurationJSON
//   extends Omit<LanguageConfiguration, 'onEnterRules' | 'indentationRules'> {
//   onEnterRules?: OnEnterRuleJSON[];
//   indentationRules?: IndentationRulesJSON;
// }

export async function makeConfig(): Promise<any> {
  return {
    comments: {
      blockComment: ['{% comment %}', '{% endcomment %}'],
    },
    brackets: [
      ['<', '>'],
      ['{{-', '-}}'],
      ['{{-', '}}'],
      ['{{', '-}}'],
      ['{{', '}}'],
      ['{%-', '-%}'],
      ['{%-', '%}'],
      ['{%', '-%}'],
      ['{%', '%}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      ['{', '}'],
      ['{{', '}}'],
      ['{%', '%}'],
      ['[', ']'],
      ['(', ')'],
      ['"', '"'],
      ["'", "'"],
      ['<', '>'],
    ],
    autoCloseBefore: '%-:.,=}])>\'"` \n\t',
    surroundingPairs: [
      ['-', '-'],
      ['<', '>'],
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
      ["'", "'"],
      ['"', '"'],
      ['`', '`'],
    ],
    onEnterRules: await onEnterRules(),
    indentationRules: await indentationRules(),
  };
}
