import {
  BLOCK_CONTENT_PARAMETER,
  BlockParameter,
  BlockParameters,
  GetDocDefinitionForURI,
  isBlockSchema,
  makeGetBlockParameters,
  Setting,
  Translations,
} from '@shopify/theme-check-common';
import { GetThemeBlockSchema } from '../json/JSONContributions';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../translations';
import { formatLiquidDocParameter } from './liquidDoc';
import { blockName } from './uri';

/** Resolves the parameters that a `block` tag in `uri` can pass to `blockName`. */
export type GetBlockParametersForURI = (
  uri: string,
  blockName: string,
) => Promise<BlockParameters | undefined>;

/**
 * Returns a lookup that creates a new block parameter resolver on every call.
 * Each completion or hover request makes one call, so the next request sees
 * edits to the target block instead of a stale interface.
 */
export function makeGetBlockParametersForURI(
  getThemeBlockSchema: GetThemeBlockSchema,
  getDocDefinitionForURI: GetDocDefinitionForURI,
): GetBlockParametersForURI {
  return (uri, targetBlockName) => {
    const getBlockParameters = makeGetBlockParameters({
      async getBlockSchema(name) {
        const schema = await getThemeBlockSchema(uri, name);
        return isBlockSchema(schema) ? schema : undefined;
      },
      getDocDefinition: (relativePath) =>
        getDocDefinitionForURI(uri, 'blocks', blockName(relativePath)),
    });

    return getBlockParameters(targetBlockName);
  };
}

/**
 * Loads the default schema translations when a parameter's schema setting
 * uses a `t:` label or info. Returns no translations when none is needed or
 * the lookup fails, so one missing locale file cannot fail the request.
 */
export async function getBlockParameterTranslations(
  getSchemaTranslationsForURI: GetTranslationsForURI,
  uri: string,
  parameters: BlockParameter[],
): Promise<Translations> {
  if (!parameters.some(hasTranslatedSchemaText)) return {};

  try {
    return await getSchemaTranslationsForURI(uri);
  } catch {
    return {};
  }
}

/**
 * Markdown shared by block parameter completion and hover. The heading follows
 * the existing LiquidDoc parameter format, followed by resolved theme-setting
 * copy and the precedence rule for `content`.
 */
export function formatBlockParameter(
  parameter: BlockParameter,
  translations: Translations,
): string {
  const { name, type, required, liquidDoc, schemaSetting } = parameter;
  const heading = formatLiquidDocParameter(
    {
      name,
      type: type ?? null,
      description: liquidDoc?.description ?? null,
      required,
    },
    true,
  );

  return [
    heading,
    schemaSetting ? formatThemeSetting(schemaSetting, translations) : undefined,
    name === BLOCK_CONTENT_PARAMETER ? CONTENT_PRECEDENCE_NOTE : undefined,
  ]
    .filter(isPresent)
    .join('\n\n');
}

const CONTENT_PRECEDENCE_NOTE =
  'A non-empty block body supplies `content` and takes precedence over a `content:` argument.';

function formatThemeSetting(setting: Setting.InputSetting, translations: Translations): string {
  return [
    '**Theme setting**',
    resolveSchemaText(setting.label, translations),
    resolveSchemaText(setting.info, translations),
  ]
    .filter(isPresent)
    .join('\n\n');
}

/**
 * Returns literal schema text unchanged and resolves a `t:` key against the
 * default schema translations. Returns undefined for a missing translation
 * rather than showing the raw key.
 */
function resolveSchemaText(
  text: string | undefined,
  translations: Translations,
): string | undefined {
  if (!text) return undefined;
  if (!isTranslationKey(text)) return text;

  const translation = translationValue(text.substring(2), translations);
  return translation ? renderTranslation(translation) : undefined;
}

function hasTranslatedSchemaText({ schemaSetting }: BlockParameter): boolean {
  return [schemaSetting?.label, schemaSetting?.info].some(isTranslationKey);
}

function isTranslationKey(text: string | undefined): boolean {
  return text?.startsWith('t:') ?? false;
}

function isPresent(text: string | undefined): text is string {
  return !!text;
}
