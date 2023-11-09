import { EnterAction, OnEnterRule } from 'vscode';

export interface OnEnterRuleJSON extends Omit<OnEnterRule, 'action'> {
  action: EnterActionJSON;
}

export interface EnterActionJSON extends Omit<EnterAction, 'indentAction'> {
  indent: 'indent' | 'indentOutdent' | 'outdent' | 'none';
}

export async function onEnterRules(): Promise<OnEnterRuleJSON[]> {
  return [];
}
