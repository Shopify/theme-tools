import { expect } from 'vitest';
import { applyEdits } from './ApplyEditsAssertion';
import { complete } from './CompletionItemsAssertion';
import { hover } from './HoverAssertion';

expect.extend({ hover, complete, applyEdits });
