import { FixApplicator, Offense, SourceCodeType, Theme } from '../types';
import { WithRequired } from '../utils/types';
import { createCorrector } from './correctors';
import { flattenFixes } from './utils';

type FixableOffense<S extends SourceCodeType> = S extends SourceCodeType
  ? WithRequired<Offense<S>, 'fix'>
  : never;

/**
 * Takes a theme, list of offenses and a fixApplicator and runs all the
 * safe ones on the theme.
 *
 * Note that offense.fix is assumed to be safe, unlike offense.suggest
 * options.
 */
export async function autofix(sourceCodes: Theme, offenses: Offense[], applyFixes: FixApplicator) {
  const fixableOffenses = offenses.filter(
    (offense): offense is FixableOffense<SourceCodeType> => 'fix' in offense && !!offense.fix,
  );

  const promises = [];

  for (const sourceCode of sourceCodes) {
    const sourceCodeOffenses = fixableOffenses.filter((offense) => offense.uri === sourceCode.uri);

    if (sourceCodeOffenses.length === 0) {
      continue;
    }

    const corrector = createCorrector(sourceCode.type, sourceCode.source);
    for (const offense of sourceCodeOffenses) {
      // I'm being slightly too clever for TypeScript here...
      offense.fix(corrector as any);
    }

    promises.push(applyFixes(sourceCode, flattenFixes(corrector.fix)));
  }

  await Promise.all(promises);
}
