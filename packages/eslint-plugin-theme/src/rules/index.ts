import type { Rule } from 'eslint';
import noStaleElementAfterAwait from './no-stale-element-after-await';
import noStoredOutsideElement from './no-stored-outside-element';
import requireGuardedCustomElementDefine from './require-guarded-custom-element-define';
import requireListenerCleanup from './require-listener-cleanup';
import requirePageStateCleanup from './require-page-state-cleanup';
import requireTeardown from './require-teardown';

export const rules: Record<string, Rule.RuleModule> = {
  'no-stale-element-after-await': noStaleElementAfterAwait,
  'no-stored-outside-element': noStoredOutsideElement,
  'require-guarded-custom-element-define': requireGuardedCustomElementDefine,
  'require-listener-cleanup': requireListenerCleanup,
  'require-page-state-cleanup': requirePageStateCleanup,
  'require-teardown': requireTeardown,
};
