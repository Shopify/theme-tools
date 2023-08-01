import chai from 'chai';
import { CompletionItemsAssertion } from './CompletionItemsAssertion';

// Setup chai extensions
const newMethods = [CompletionItemsAssertion];

newMethods.forEach(({ name, fn }) => {
  chai.Assertion.addMethod(name, fn);
});
