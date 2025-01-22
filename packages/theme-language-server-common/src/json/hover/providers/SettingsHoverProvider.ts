import { isError } from '@shopify/theme-check-common';
import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../../../translations';
import { isLiquidRequestContext, LiquidRequestContext, RequestContext } from '../../RequestContext';
import { fileMatch } from '../../utils';
import { JSONHoverProvider } from '../JSONHoverProvider';
import { AugmentedLiquidSourceCode } from '../../../documents';
import { isSectionOrBlockSchema } from '../../completions/providers/BlockTypeCompletionProvider';

export class SettingsHoverProvider implements JSONHoverProvider {
  private uriPatterns = [/(sections|blocks)\/[^\/]*\.liquid$/];

  constructor(private getDefaultSchemaTranslations: GetTranslationsForURI) {}

  canHover(context: RequestContext, path: JSONPath): context is LiquidRequestContext {
    return (
      fileMatch(context.doc.uri, this.uriPatterns) &&
      isLiquidRequestContext(context) &&
      path.length !== 0 &&
      (isPresetSettingsPath(path) || isDefaultSettingsPath(path))
    );
  }

  async hover(context: RequestContext, path: JSONPath): Promise<MarkedString[]> {
    if (!this.canHover(context, path)) return [];

    const { doc } = context;
    const label = await getSettingsLabel(doc, path.at(-1) as string);

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

function isPresetSettingsPath(path: JSONPath) {
  return (
    path.at(0) === 'presets' &&
    path.at(2) === 'settings' &&
    path.at(3) !== undefined &&
    typeof path.at(3) === 'string'
  );
}

function isDefaultSettingsPath(path: JSONPath) {
  return (
    path.at(0) === 'default' &&
    path.at(1) === 'settings' &&
    path.at(2) !== undefined &&
    typeof path.at(2) === 'string'
  );
}

async function getSettingsLabel(
  doc: AugmentedLiquidSourceCode,
  label: string,
): Promise<string | undefined> {
  const schema = await doc.getSchema();

  if (
    !schema ||
    !isSectionOrBlockSchema(schema) ||
    isError(schema.parsed) ||
    schema.parsed.settings === undefined ||
    !Array.isArray(schema.parsed.settings)
  ) {
    return;
  }

  return schema.parsed.settings.find((setting: any) => setting.id === label)?.label;
}
