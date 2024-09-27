import { EnterAction, OnEnterRule } from 'vscode';
import { voidElements } from './constants';

export interface OnEnterRuleJSON extends Omit<OnEnterRule, 'action' | 'beforeText' | 'afterText'> {
  beforeText?: string;
  afterText?: string;
  action: EnterActionJSON;
}

export interface EnterActionJSON extends Omit<EnterAction, 'indentAction'> {
  indent: 'indent' | 'indentOutdent' | 'outdent' | 'none';
}

export async function onEnterRules(): Promise<OnEnterRuleJSON[]> {
  // Adapted from the Monaco Editor source code
  // https://github.com/microsoft/monaco-editor/blob/f6dc0eb8fce67e57f6036f4769d92c1666cdf546/src/basic-languages/html/html.ts#L88
  return [
    {
      beforeText: `<(?!(?:${voidElements.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
      afterText: `^<\\/([_:\\w][_:\\w-.\\d]*)\\s*>$`,
      action: {
        indent: 'indentOutdent',
      },
    },
    {
      beforeText: `<(?!(?:${voidElements.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
      action: { indent: 'indent' },
    },
  ];
}
