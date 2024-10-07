import { EnterAction, OnEnterRule } from 'vscode';
import { voidElements, increaseIndentTags, blockEndTags } from './constants';

export interface OnEnterRuleJSON extends Omit<OnEnterRule, 'action' | 'beforeText' | 'afterText'> {
  beforeText?: string;
  afterText?: string;
  action: EnterActionJSON;
}

export interface EnterActionJSON extends Omit<EnterAction, 'indentAction'> {
  indent: 'indent' | 'indentOutdent' | 'outdent' | 'none';
}

const OPEN_TAG = '\\{%';
const CLOSE_TAG = '%\\}';

export async function onEnterRules(): Promise<OnEnterRuleJSON[]> {
  // Adapted from the Monaco Editor source code
  // https://github.com/microsoft/monaco-editor/blob/f6dc0eb8fce67e57f6036f4769d92c1666cdf546/src/basic-languages/html/html.ts#L88
  return [
    {
      // Matches an opening tag that is not a void element, capturing the tag name and attributes
      beforeText: `<(?!(?:${voidElements.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`,
      // Matches a closing tag that corresponds to the previously captured opening tag
      afterText: `^<\\/([_:\\w][_:\\w-.\\d]*)\\s*>$`,
      action: {
        indent: 'indentOutdent',
      },
    },
    {
      // Matches an opening tag that is not a void element, capturing the tag name and attributes
      beforeText: `<(?!(?:${voidElements.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`,
      action: { indent: 'indent' },
    },
    {
      // prettier-ignore
      beforeText: `${OPEN_TAG}-?\\s*(?!end)(?:${increaseIndentTags.join('|')})((?!${CLOSE_TAG}).)*${CLOSE_TAG}\\s*$`,
      afterText: `^${OPEN_TAG}-?\\s*(?:${blockEndTags.join('|')})((?!${CLOSE_TAG}).)*${CLOSE_TAG}`,
      action: {
        indent: 'indentOutdent',
      },
    },
    {
      // prettier-ignore
      beforeText: `${OPEN_TAG}-?\\s*(?!end)(?:${increaseIndentTags.join('|')})((?!${CLOSE_TAG}).)*${CLOSE_TAG}\\s*$`,
      action: {
        indent: 'indent',
      },
    },
  ];
}
