import { chai, expect } from 'vitest';
import { CompletionItemsAssertion } from './CompletionItemsAssertion';
import { hover } from './HoverAssertion';

// Setup chai extensions
const newMethods = [CompletionItemsAssertion];

newMethods.forEach(({ name, fn }) => {
  chai.Assertion.addMethod(name, fn);
});

expect.extend({ hover });
