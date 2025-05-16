import {
  AppBlockSchema,
  deepGet,
  isError,
  SectionSchema,
  Setting,
  ThemeBlockSchema,
} from '@shopify/theme-check-common';
import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../../../translations';
import { isLiquidRequestContext, LiquidRequestContext, RequestContext } from '../../RequestContext';
import { isSectionOrBlockFile } from '../../utils';
import { JSONHoverProvider } from '../JSONHoverProvider';
import { isSectionOrBlockSchema } from '../../completions/providers/BlockTypeCompletionProvider';
import { GetThemeBlockSchema } from '../../JSONContributions';
import { getSectionBlockByName } from '../../schemaSettings';

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

    const sectionBlock = getSectionBlockByName(schema.parsed, blockType);

    let label: string | undefined;

    if (sectionBlock) {
      if (!hasValidSettings(sectionBlock.settings)) return [];

      label = getSettingLabelById(sectionBlock.settings, path.at(-1) as string);
    } else {
      const themeBlockSchema = await this.getThemeBlockSchema(doc.uri, blockType);

      if (!isValidSchema(themeBlockSchema)) return [];
      if (!hasValidSettings(themeBlockSchema.parsed.settings)) return [];

      label = getSettingLabelById(themeBlockSchema.parsed.settings, path.at(-1) as string);
    }

    if (!label) return [];

    if (!label.startsWith('t:')) {
      return [label];
    }

    const translations = await this.getDefaultSchemaTranslations(doc.uri);

    const value = translationValue(label.substring(2), translations);
    if (!value) return [];

    return [renderTranslation(value)];
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

function hasValidSettings(settings: any): settings is Partial<Setting.Any>[] {
  return settings !== undefined && Array.isArray(settings);
}

function getSettingLabelById(settings: Partial<Setting.Any>[], id: string) {
  return settings.find((setting) => setting.id === id)?.label;
}
