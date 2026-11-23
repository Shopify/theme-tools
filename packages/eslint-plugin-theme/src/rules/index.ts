import type { Rule } from 'eslint';
import noStoredOutsideElement from './no-stored-outside-element';

export const rules: Record<string, Rule.RuleModule> = {
  'no-stored-outside-element': noStoredOutsideElement,
};
