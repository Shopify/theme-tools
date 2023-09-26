import { expect } from 'vitest';
import { complete } from './CompletionItemsAssertion';
import { hover } from './HoverAssertion';

expect.extend({ hover, complete });
