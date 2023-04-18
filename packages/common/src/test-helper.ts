import chai from 'chai';
import {
  check as coreCheck,
  toSourceCode,
  Offense,
  Config,
  SourceCodeType,
  Theme,
  JSONSourceCode,
  LiquidSourceCode,
  CheckDefinition,
  recommended,
} from './index';
import { OffensesAssertion } from './test-helper/chai-offenses-assertion';

// Setup 'chai' extensions
chai.Assertion.addMethod(OffensesAssertion.name, OffensesAssertion.fn);

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
    get defaultLocale() {
      return defaultTranslationsFileAbsolutePath.match(/locales\/(.*)\.default\.json$/)?.[1]!;
    },
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
