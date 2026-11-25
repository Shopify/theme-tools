import { chai, expect } from 'vitest';
import { containOffense } from './contain-offense';
import { OfferFixAssertion } from './chai-offer-fix-assertion';
import { SuggestAssertion } from './chai-suggest-assertion';

/**
 * Setup chai extensions
 *
 * These are deprecated in favor of vitest matchers.
 */
const chaiAssertions = [OfferFixAssertion, SuggestAssertion];
chaiAssertions.forEach(({ name, fn }) => {
  chai.Assertion.addMethod(name, fn);
});

/**
 * Setup vitest matcher extensions
 *
 * All new matchers should be written this way.
 */
expect.extend({ containOffense });

/**
 * Vitest runs setup files before every test file, and test files can share one
 * process. Mark the process so each worker installs the logger only once.
 */
const unhandledRejectionLoggerInstalled = Symbol.for('theme-tools.unhandledRejectionLogger');
installUnhandledRejectionLogger();

function installUnhandledRejectionLogger() {
  if (Reflect.get(process, unhandledRejectionLoggerInstalled)) return;

  Reflect.set(process, unhandledRejectionLoggerInstalled, true);
  process.on('unhandledRejection', logUnhandledRejection);
}

function logUnhandledRejection(reason: unknown) {
  console.error(reason);
  debugger;
}
