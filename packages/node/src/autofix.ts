import { EditorState, TransactionSpec } from '@codemirror/state';
import { writeFile } from 'fs/promises';
import {
  Fix,
  Offense,
  Theme,
  autofix as coreAutofix,
  flattenFixes,
  FixApplicator,
} from '@shopify/theme-check-common';

function applyFix(source: string, fixes: Fix): string {
  const state = EditorState.create({ doc: source });
  const fixDescs = flattenFixes(fixes);
  const specs: TransactionSpec[] = fixDescs.map((fix) => ({
    changes: [
      {
        from: fix.startIndex,
        to: fix.endIndex,
        insert: fix.insert,
      },
    ],
  }));
  const transaction = state.update(...specs);
  return transaction.state.doc.toString();
}

export const saveToDiskFixApplicator: FixApplicator = async (sourceCode, fix) => {
  const updatedSource = applyFix(sourceCode.source, fix);
  await writeFile(sourceCode.absolutePath, updatedSource, 'utf8');
};

/**
 * Apply and save to disk the safe fixes for a set of offenses on a theme.
 */
export async function autofix(sourceCodes: Theme, offenses: Offense[]) {
  await coreAutofix(sourceCodes, offenses, saveToDiskFixApplicator);
}
