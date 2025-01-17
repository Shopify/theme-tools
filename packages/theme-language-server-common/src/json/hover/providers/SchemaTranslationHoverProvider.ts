import { deepGet } from '@shopify/theme-check-common';
import { JSONPath, MarkedString } from 'vscode-json-languageservice';
import { GetTranslationsForURI, renderTranslation, translationValue } from '../../../translations';
import { isLiquidRequestContext, LiquidRequestContext, RequestContext } from '../../RequestContext';
import { isSectionOrBlockFile } from '../../utils';
import { JSONHoverProvider } from '../JSONHoverProvider';

export class SchemaTranslationHoverProvider implements JSONHoverProvider {
  constructor(private getDefaultSchemaTranslations: GetTranslationsForURI) {}

  canHover(context: RequestContext, path: JSONPath): context is LiquidRequestContext {
    const label = deepGet(context.parsed, path);
    return (
      isSectionOrBlockFile(context.doc.uri) &&
      isLiquidRequestContext(context) &&
      path.length !== 0 &&
      label &&
      typeof label === 'string' &&
      label.startsWith('t:')
    );
  }

  async hover(context: RequestContext, path: JSONPath): Promise<MarkedString[]> {
    if (!this.canHover(context, path)) return [];
    // Can assert is a string because of `canHover` check above
    const label = deepGet(context.parsed, path) as string;
    return this.getDefaultSchemaTranslations(context.doc.uri).then((translations) => {
      const path = label.slice(2); // remove `t:`
      const value = translationValue(path, translations);
      if (!value) return undefined as any;

      return [renderTranslation(value)];
    });
  }
}
