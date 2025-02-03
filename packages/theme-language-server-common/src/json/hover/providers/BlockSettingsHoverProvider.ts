import {
  AppBlockSchema,
  deepGet,
  isError,
  SectionSchema,
  ThemeBlockSchema,
} from '@shopify/theme-check-common';
import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../../../translations';
import { isLiquidRequestContext, LiquidRequestContext, RequestContext } from '../../RequestContext';
import { isSectionOrBlockFile } from '../../utils';
import { JSONHoverProvider } from '../JSONHoverProvider';
import { isSectionOrBlockSchema } from '../../completions/providers/BlockTypeCompletionProvider';
import { GetThemeBlockSchema } from '../../JSONContributions';

export class BlockSettingsHoverProvider implements JSONHoverProvider {
  constructor(
    private getDefaultSchemaTranslations: GetTranslationsForURI,
    private getThemeBlockSchema: GetThemeBlockSchema,
  ) {}

  canHover(context: RequestContext, path: JSONPath): context is LiquidRequestContext {
    return (
      isSectionOrBlockFile(context.doc.uri) &&
      isLiquidRequestContext(context) &&
      path.length !== 0 &&
      isBlocksSettingsPath(path)
    );
  }

  async hover(context: RequestContext, path: JSONPath): Promise<MarkedString[]> {
    if (!this.canHover(context, path)) return [];

    const { doc } = context;
    const schema = await doc.getSchema();

    if (!isValidSchema(schema)) return [];

    const blockType = deepGet(schema.parsed, [...path.slice(0, -2), 'type']);

    if (!blockType) return [];

    const themeBlockSchema = await this.getThemeBlockSchema(doc.uri, blockType);

    if (!isValidSchema(themeBlockSchema)) return [];
    if (!hasValidSchemaSettings(themeBlockSchema)) return [];

    const label = themeBlockSchema.parsed.settings.find(
      (setting: any) => setting?.id === path.at(-1),
    )?.label;

    if (!label) return [];

    if (!label.startsWith('t:')) {
      return [label];
    }

    return this.getDefaultSchemaTranslations(doc.uri).then((translations) => {
      const path = label.substring(2);
      const value = translationValue(path, translations);
      if (!value) return undefined as any;

      return [renderTranslation(value)];
    });
  }
}

function isBlocksSettingsPath(path: JSONPath) {
  return (
    (path.at(0) === 'presets' || path.at(0) === 'default') &&
    path.at(-4) === 'blocks' &&
    path.at(-2) === 'settings' &&
    path.at(-1) !== undefined &&
    typeof path.at(-1) === 'string'
  );
}

function isValidSchema(
  schema: SectionSchema | ThemeBlockSchema | AppBlockSchema | undefined,
): schema is SectionSchema | ThemeBlockSchema {
  return !!schema && !isError(schema.parsed) && isSectionOrBlockSchema(schema);
}

function hasValidSchemaSettings(schema: SectionSchema | ThemeBlockSchema) {
  return schema.parsed?.settings !== undefined && Array.isArray(schema.parsed.settings);
}
