import {
  check as coreCheck,
  autofix as coreAutofix,
  applyFixToString,
  toSourceCode,
  Offense,
  Config,
  SourceCodeType,
  Theme,
  JSONSourceCode,
  LiquidSourceCode,
  CheckDefinition,
  recommended,
  StringCorrector,
  JSONCorrector,
  FixApplicator,
  createCorrector,
} from '../index';

export { StringCorrector, JSONCorrector };

/**
 * @example
 * {
 *   'theme/layout.liquid': `
 *     <html>
 *       {{ content_for_page }}
 *     </html>
 *   `,
 *   'snippets/snip.liquid': `
 *     <b>'hello world'</b>
 *   `,
 * }
 */
export type MockTheme = {
  [relativePath in string]: string;
};

export function getTheme(themeDesc: MockTheme): Theme {
  return Object.entries(themeDesc)
    .map(([relativePath, source]) => toSourceCode(asAbsolutePath(relativePath), source))
    .filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}

export async function check(
  themeDesc: MockTheme,
  checks: CheckDefinition<SourceCodeType>[] = recommended,
): Promise<Offense[]> {
  const theme = getTheme(themeDesc);
  const config: Config = {
    settings: {},
    checks: checks,
    root: '/',
  };
  const defaultTranslationsFileAbsolutePath = 'locales/en.default.json';
  return coreCheck(theme, config, {
    async fileExists(absolutePath: string) {
      const relativePath = absolutePath.replace(/^\//, '');
      return themeDesc[relativePath] !== undefined;
    },
    async getDefaultTranslations() {
      try {
        return JSON.parse(themeDesc[defaultTranslationsFileAbsolutePath] || '{}');
      } catch (e) {
        if (e instanceof SyntaxError) return {};
        throw e;
      }
    },
    async getDefaultLocale() {
      return defaultTranslationsFileAbsolutePath.match(/locales\/(.*)\.default\.json$/)?.[1]!;
    },
  });
}

export async function runLiquidCheck(
  checkDef: CheckDefinition<SourceCodeType.LiquidHtml>,
  sourceCode: string,
  fileName: string = 'file.liquid',
): Promise<Offense[]> {
  const offenses = await check({ [fileName]: sourceCode }, [checkDef]);
  return offenses.filter((offense) => offense.absolutePath === `/${fileName}`);
}

export async function runJSONCheck(
  checkDef: CheckDefinition<SourceCodeType.JSON>,
  sourceCode: string,
  fileName: string = 'file.json',
): Promise<Offense[]> {
  const offenses = await check({ [fileName]: sourceCode }, [checkDef]);
  return offenses.filter((offense) => offense.absolutePath === `/${fileName}`);
}

export async function autofix(themeDesc: MockTheme, offenses: Offense[]) {
  const theme = getTheme(themeDesc);
  const fixed = { ...themeDesc };

  const stringApplicator: FixApplicator = async (sourceCode, fixes) => {
    fixed[asRelative(sourceCode.absolutePath)] = applyFixToString(sourceCode.source, fixes);
  };

  await coreAutofix(theme, offenses, stringApplicator);

  return fixed;
}

export function applyFix(
  themeDescOrSource: MockTheme | string,
  offense: Offense,
): string | undefined {
  const source =
    typeof themeDescOrSource === 'string'
      ? themeDescOrSource
      : themeDescOrSource[asRelative(offense.absolutePath)];
  const corrector = createCorrector(offense.type, source);
  offense.fix?.(corrector as any);
  return applyFixToString(source, corrector.fix);
}

export function applySuggestions(
  themeDescOrSource: MockTheme | string,
  offense: Offense,
): undefined | string[] {
  const source =
    typeof themeDescOrSource === 'string'
      ? themeDescOrSource
      : themeDescOrSource[asRelative(offense.absolutePath)];
  return offense.suggest?.map((suggestion) => {
    const corrector = createCorrector(offense.type, source);
    suggestion.fix(corrector as any);
    return applyFixToString(source, corrector.fix);
  });
}

export function highlightedOffenses(theme: MockTheme, offenses: Offense[]) {
  return offenses.map((offense) => {
    const relativePath = offense.absolutePath.substring(1);
    const source = theme[relativePath];
    const {
      start: { index: startIndex },
      end: { index: endIndex },
    } = offense;

    return source.slice(startIndex, endIndex);
  });
}

function asAbsolutePath(relativePath: string) {
  return '/' + relativePath;
}

function asRelative(absolutePath: string) {
  return absolutePath.replace(/^\//, '');
}

export function prettyJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}
