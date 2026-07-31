import { runLiquidCheck } from '../../../test';
import { LiquidSyntaxError } from '../index';

export interface LintDiagnostic {
  message: string;
  line: number;
}

const DEFAULT_PATH = 'templates/template.liquid';

/**
 * `themeDocset: undefined` drives tag-name recognition through the real
 * `builtinTags` fallback in base.ts (the test harness would otherwise inject
 * a docset whose `tags()` returns `[]`).
 */
const NO_DOCSET = { themeDocset: undefined } as const;

export async function lintLiquid(
  template: string,
  filePath: string = DEFAULT_PATH,
): Promise<LintDiagnostic[]> {
  const fileName = filePath.replace(/^\/+/, '');
  const offenses = await runLiquidCheck(LiquidSyntaxError, template, fileName, NO_DOCSET);
  return offenses.map((offense) => ({
    message: offense.message,
    line: offense.start.line,
  }));
}
