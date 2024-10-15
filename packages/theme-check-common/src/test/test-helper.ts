import {
  applyFixToString,
  CheckDefinition,
  ChecksSettings,
  Config,
  autofix as coreAutofix,
  check as coreCheck,
  createCorrector,
  Dependencies,
  FixApplicator,
  JSONCorrector,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  parseJSON,
  recommended,
  SourceCodeType,
  StringCorrector,
  Theme,
  toSourceCode,
} from '../index';
import { MockFileSystem } from './MockFileSystem';
import { MockTheme } from './MockTheme';

export { JSONCorrector, StringCorrector };

export function getTheme(themeDesc: MockTheme): Theme {
  return Object.entries(themeDesc)
    .map(([relativePath, source]) => toSourceCode(asAbsolutePath(relativePath), source))
    .filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}

export async function check(
  themeDesc: MockTheme,
  checks: CheckDefinition<SourceCodeType>[] = recommended,
  mockDependencies: Partial<Dependencies> = {},
  checkSettings: ChecksSettings = {},
): Promise<Offense[]> {
  const theme = getTheme(themeDesc);
  const config: Config = {
    context: 'theme',
    settings: { ...checkSettings },
    checks: checks,
    rootUri: 'file:/',
  };
  const defaultTranslationsFileRelativePath = 'locales/en.default.json';
  const defaultSchemaTranslationsFileRelativePath = 'locales/en.default.schema.json';

  const defaultMockDependencies = {
    fs: new MockFileSystem(themeDesc),
    async fileSize(absolutePath: string) {
      const relativePath = absolutePath.replace('file:/', '');
      return themeDesc[relativePath].length;
    },
    async getDefaultTranslations() {
      return parseJSON(themeDesc[defaultTranslationsFileRelativePath] || '{}', {});
    },
    async getDefaultSchemaTranslations() {
      return parseJSON(themeDesc[defaultSchemaTranslationsFileRelativePath] || '{}', {});
    },
    themeDocset: {
      async filters() {
        return [
          { name: 'item_count_for_variant' },
          { name: 'link_to_type' },
          { name: 'link_to_vendor' },
          { name: 'append' },
          { name: 'color_to_rgb' },
          {
            name: 'hex_to_rgba',
            deprecated: true,
            deprecation_reason: '`hex_to_rgba` has been replaced by [`color_to_rgb`](/do...',
          },
          {
            name: 'currency_selector',
            deprecated: true,
            deprecation_reason: 'Deprecated without a direct replacement because the [cur...',
          },
          {
            name: 'article_img_url',
            deprecated: true,
            deprecation_reason: '`article_img_url` has been replaced by [`image_url`](/d...',
          },
          {
            name: 'collection_img_url',
            deprecated: true,
            deprecation_reason: '`collection_img_url` has been replaced by [`image_url`](...',
          },
          {
            name: 'img_tag',
            deprecated: true,
            deprecation_reason: '`img_tag` has been replaced by [`image_tag`](/docs/api/...',
          },
          {
            name: 'img_url',
            deprecated: true,
            deprecation_reason: '`img_url` has been replaced by [`image_url`](/docs/api/...',
          },
          {
            name: 'product_img_url',
            deprecated: true,
            deprecation_reason: '`product_img_url` has been replaced by [`image_url`](/d...',
          },
        ];
      },
      async objects() {
        return [
          {
            name: 'collections',
          },
          {
            name: 'product',
            access: {
              global: false,
              parents: [],
              template: ['product'],
            },
          },
          {
            name: 'image',
            access: {
              global: false,
              parents: [],
              template: [],
            },
          },
          {
            name: 'section',
            access: {
              global: false,
              parents: [],
              template: [],
            },
          },
          {
            name: 'block',
            access: {
              global: false,
              parents: [],
              template: [],
            },
          },
          {
            name: 'app',
            access: {
              global: false,
              parents: [],
              template: [],
            },
          },
          {
            name: 'predictive_search',
            access: {
              global: false,
              parents: [],
              template: [],
            },
          },
          {
            name: 'recommendations',
            access: {
              global: false,
              parents: [],
              template: [],
            },
          },
          {
            name: 'comment',
            access: {
              global: false,
              parents: [],
              template: [],
            },
          },
        ];
      },
      async tags() {
        return [];
      },
      async systemTranslations() {
        return { 'shopify.sentence.words_connector': ', ' };
      },
    },
  };

  return coreCheck(theme, config, { ...defaultMockDependencies, ...mockDependencies });
}

export async function runLiquidCheck(
  checkDef: CheckDefinition<SourceCodeType.LiquidHtml>,
  sourceCode: string,
  fileName: string = 'file.liquid',
  mockDependencies: Partial<Dependencies> = {},
): Promise<Offense[]> {
  const offenses = await check({ [fileName]: sourceCode }, [checkDef], mockDependencies);
  return offenses.filter((offense) => offense.absolutePath === `/${fileName}`);
}

export async function runJSONCheck(
  checkDef: CheckDefinition<SourceCodeType.JSON>,
  sourceCode: string,
  fileName: string = 'file.json',
  mockDependencies: Partial<Dependencies> = {},
): Promise<Offense[]> {
  const offenses = await check({ [fileName]: sourceCode }, [checkDef], mockDependencies);
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

export function highlightedOffenses(themeOrSource: MockTheme | string, offenses: Offense[]) {
  const theme =
    typeof themeOrSource === 'string' ? { 'file.liquid': themeOrSource } : themeOrSource;
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
