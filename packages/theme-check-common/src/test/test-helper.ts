import { isLiquidHtmlNode } from '@shopify/liquid-html-parser';
import {
  applyFixToString,
  CheckDefinition,
  ChecksSettings,
  Config,
  autofix as coreAutofix,
  check as coreCheck,
  createCorrector,
  Dependencies,
  extractDocDefinition,
  FixApplicator,
  isBlock,
  isSection,
  JSONCorrector,
  JSONSourceCode,
  LiquidSourceCode,
  Offense,
  recommended,
  SectionSchema,
  SourceCodeType,
  StringCorrector,
  Theme,
  ThemeBlockSchema,
  toSchema,
  toSourceCode,
} from '../index';
import * as path from '../path';
import { MockFileSystem } from './MockFileSystem';
import { MockTheme } from './MockTheme';

export { JSONCorrector, StringCorrector };

const rootUri = path.normalize('file:/');

export function getTheme(themeDesc: MockTheme): Theme {
  return Object.entries(themeDesc)
    .map(([relativePath, source]) => toSourceCode(toUri(relativePath), source))
    .filter((x): x is LiquidSourceCode | JSONSourceCode => x !== undefined);
}

export async function check(
  themeDesc: MockTheme,
  checks: CheckDefinition[] = recommended,
  mockDependencies: Partial<Dependencies> = {},
  checkSettings: ChecksSettings = {},
): Promise<Offense[]> {
  const theme = getTheme(themeDesc);
  const config: Config = {
    context: 'theme',
    settings: { ...checkSettings },
    checks,
    rootUri,
    onError: (err) => {
      throw err;
    },
  };

  const sections = new Map(
    theme
      .filter((source) => isSection(source.uri))
      .map((source) => [path.basename(source.uri, '.liquid'), source]),
  );
  const blocks = new Map(
    theme
      .filter((source) => isBlock(source.uri))
      .map((source) => [path.basename(source.uri, '.liquid'), source]),
  );

  /**
   * Schemas are assumed to be valid in tests, hijack
   * getBlockSchema/getSectionSchema with overrides when you want to test
   * something otherwise
   */
  const isValidSchema = async () => true;

  const defaultMockDependencies: Dependencies = {
    fs: new MockFileSystem({ '.theme-check.yml': '', ...themeDesc }),
    async getBlockSchema(name) {
      const block = blocks.get(name);
      if (!block) return undefined;
      return toSchema(config.context, block.uri, block, isValidSchema) as Promise<
        ThemeBlockSchema | undefined
      >;
    },
    async getSectionSchema(name) {
      const section = sections.get(name);
      if (!section) return undefined;
      return toSchema(config.context, section.uri, section, isValidSchema) as Promise<
        SectionSchema | undefined
      >;
    },
    async getDocDefinition(relativePath) {
      const file = theme.find((file) => file.uri.endsWith(relativePath));
      if (!file || !isLiquidHtmlNode(file.ast)) {
        return undefined;
      }
      return extractDocDefinition(file.uri, file.ast);
    },
    themeDocset: {
      async filters() {
        return [
          { name: 'item_count_for_variant' },
          { name: 'link_to_type' },
          { name: 'link_to_vendor' },
          { name: 'append' },
          { name: 'upcase' },
          { name: 'downcase' },
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
      async liquidDrops() {
        return this.objects();
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
  existingThemeFiles?: MockTheme,
): Promise<Offense[]> {
  const offenses = await check(
    { ...existingThemeFiles, [fileName]: sourceCode },
    [checkDef],
    mockDependencies,
  );
  return offenses.filter((offense) => offense.uri === path.join(rootUri, fileName));
}

export async function runJSONCheck(
  checkDef: CheckDefinition<SourceCodeType.JSON>,
  sourceCode: string,
  fileName: string = 'file.json',
  mockDependencies: Partial<Dependencies> = {},
): Promise<Offense[]> {
  const offenses = await check({ [fileName]: sourceCode }, [checkDef], mockDependencies);
  return offenses.filter((offense) => offense.uri === path.join(rootUri, fileName));
}

export async function autofix(themeDesc: MockTheme, offenses: Offense[]) {
  const theme = getTheme(themeDesc);
  const fixed = { ...themeDesc };

  const stringApplicator: FixApplicator = async (sourceCode, fixes) => {
    fixed[asRelative(sourceCode.uri)] = applyFixToString(sourceCode.source, fixes);
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
      : themeDescOrSource[asRelative(offense.uri)];
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
      : themeDescOrSource[asRelative(offense.uri)];
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
    const relativePath = path.relative(offense.uri, rootUri);
    const source = theme[relativePath];
    const {
      start: { index: startIndex },
      end: { index: endIndex },
    } = offense;

    return source.slice(startIndex, endIndex);
  });
}

function toUri(relativePath: string) {
  return path.join(rootUri, relativePath);
}

function asRelative(uri: string) {
  return path.relative(path.normalize(uri), rootUri);
}

export function prettyJSON(obj: any): string {
  return JSON.stringify(obj, null, 2);
}
