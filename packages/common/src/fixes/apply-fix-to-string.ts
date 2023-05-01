import { Fix } from '../types';
import { flattenFixes } from './utils';

// First iteration imported @codemirror/state to do this but it's kind of
// a gross dependency. I asked chatGPT to make me something similar and,
// after a couple of prompts, was surprised to like the result.
//
// So here goes:
// A neat and mean (Source, Fix) => Source function :)
export function applyFixToString(source: string, fix: Fix): string {
  // Create a copy of the original string to store the modified result
  let newStr = source;

  // Initialize an offset variable to keep track of the changes in index
  // due to previous fixes. This is necessary because each modification
  // is assumed to be to the original document, and we need to account for
  // the index drift caused by previous fixes.
  let offset = 0;

  // Sort modifications by startIndex in ascending order to ensure that
  // modifications with lower indices are applied first. This helps to
  // maintain the correct index positions for subsequent modifications.
  const sortedFixes = flattenFixes(fix).sort((a, b) => a.startIndex - b.startIndex);

  // Verify that the fixes are valid and do not overlap
  for (let i = 0; i < sortedFixes.length - 1; i++) {
    const currentFix = sortedFixes[i];
    const nextFix = sortedFixes[i + 1];

    // Check if the current fix overlaps with the next fix
    if (currentFix.endIndex > nextFix.startIndex) {
      throw new Error('Overlapping ranges are not allowed');
    }
  }

  for (const fix of sortedFixes) {
    // Drift-adjust the fix location
    const startIndex = fix.startIndex + offset;
    const endIndex = fix.endIndex + offset;

    // Throw an error if either startIndex or endIndex are out of bounds.
    if (
      startIndex < 0 ||
      startIndex > newStr.length ||
      endIndex < startIndex ||
      endIndex > newStr.length
    ) {
      throw new Error('Fix description is going overboard');
    }

    // Perform the modification at the drift-adjusted location
    newStr = newStr.slice(0, startIndex) + fix.insert + newStr.slice(endIndex);

    // Account for "index drift" as the modifications are applied.
    offset += fix.insert.length - (endIndex - startIndex);
  }

  return newStr;
}
