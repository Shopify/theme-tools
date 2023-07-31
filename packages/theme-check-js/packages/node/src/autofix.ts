import { writeFile } from 'fs/promises';
import {
  Offense,
  Theme,
  autofix as coreAutofix,
  FixApplicator,
  applyFixToString,
} from '@shopify/theme-check-common';

export const saveToDiskFixApplicator: FixApplicator = async (sourceCode, fix) => {
  const updatedSource = applyFixToString(sourceCode.source, fix);
  await writeFile(sourceCode.absolutePath, updatedSource, 'utf8');
};

/**
 * Apply and save to disk the safe fixes for a set of offenses on a theme.
 */
export async function autofix(sourceCodes: Theme, offenses: Offense[]) {
  await coreAutofix(sourceCodes, offenses, saveToDiskFixApplicator);
}
