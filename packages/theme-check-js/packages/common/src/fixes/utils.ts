import { Fix, FixDescription } from '../types';

export function flattenFixes(fix: Fix): FixDescription[] {
  if (!Array.isArray(fix)) return [fix];
  return fix.flatMap(flattenFixes);
}
