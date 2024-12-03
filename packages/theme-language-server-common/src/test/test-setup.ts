import { expect } from 'vitest';
import { applyTextEdit } from './ApplyTextEditAssertion';
import { complete } from './CompletionItemsAssertion';
import { hover } from './HoverAssertion';

expect.extend({ hover, complete, applyTextEdit });
