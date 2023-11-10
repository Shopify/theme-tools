import { indentationRules } from './indentation-rules';
import { onEnterRules } from './on-enter-actions';

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
      ['{{', ' }}'],
      ['{%', ' %}'],
      ['[', ']'],
      ['(', ')'],
      ['"', '"'],
      ["'", "'"],
      ['<', '>'],
    ],
    autoCloseBefore: '%-:.,=}])<>\'"` \n\t',
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
