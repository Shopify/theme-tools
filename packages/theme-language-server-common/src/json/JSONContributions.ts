import {
  AppBlockSchema,
  parseJSON,
  SectionSchema,
  SourceCodeType,
  ThemeBlockSchema,
} from '@shopify/theme-check-common';
import {
  CompletionsCollector,
  JSONPath,
  JSONWorkerContribution,
  MarkedString,
} from 'vscode-json-languageservice';
import { AugmentedSourceCode, DocumentManager } from '../documents';
import { GetTranslationsForURI } from '../translations';
import { JSONCompletionProvider } from './completions/JSONCompletionProvider';
import { BlockTypeCompletionProvider } from './completions/providers/BlockTypeCompletionProvider';
import { PresetsBlockTypeCompletionProvider } from './completions/providers/PresetsBlockTypeCompletionProvider';
import { SchemaTranslationsCompletionProvider } from './completions/providers/SchemaTranslationCompletionProvider';
import { JSONHoverProvider } from './hover/JSONHoverProvider';
import { SchemaTranslationHoverProvider } from './hover/providers/SchemaTranslationHoverProvider';
import { TranslationPathHoverProvider } from './hover/providers/TranslationPathHoverProvider';
import { RequestContext } from './RequestContext';
import { findSchemaNode } from './utils';
import { SettingsPropertyCompletionProvider } from './completions/providers/SettingsPropertyCompletionProvider';
import { SettingsHoverProvider } from './hover/providers/SettingsHoverProvider';

/** The getInfoContribution API will only fallback if we return undefined synchronously */
const SKIP_CONTRIBUTION = undefined as any;

export type GetThemeBlockSchema = (
  uri: string,
  name: string,
) => Promise<SectionSchema | ThemeBlockSchema | AppBlockSchema | undefined>;
export type GetThemeBlockNames = (uri: string, includePrivate: boolean) => Promise<string[]>;

/**
 * I'm not a fan of how json-languageservice does its feature contributions. It's too different
 * from everything else we do in here.
 *
 * Instead, we'll have this little adapter that makes the completions and hover providers feel
 * a bit more familiar.
 */
export class JSONContributions implements JSONWorkerContribution {
  private hoverProviders: JSONHoverProvider[];
  private completionProviders: JSONCompletionProvider[];

  constructor(
    private documentManager: DocumentManager,
    getDefaultSchemaTranslations: GetTranslationsForURI,
    getThemeBlockNames: GetThemeBlockNames,
    getThemeBlockSchema: GetThemeBlockSchema,
  ) {
    this.hoverProviders = [
      new TranslationPathHoverProvider(),
      new SchemaTranslationHoverProvider(getDefaultSchemaTranslations),
      new SettingsHoverProvider(getDefaultSchemaTranslations),
    ];
    this.completionProviders = [
      new SchemaTranslationsCompletionProvider(getDefaultSchemaTranslations),
      new BlockTypeCompletionProvider(getThemeBlockNames),
      new PresetsBlockTypeCompletionProvider(getThemeBlockNames, getThemeBlockSchema),
      new SettingsPropertyCompletionProvider(getDefaultSchemaTranslations),
    ];
  }

  getInfoContribution(uri: string, location: JSONPath): Promise<MarkedString[]> {
    const doc = this.documentManager.get(uri);
    if (!doc) return SKIP_CONTRIBUTION;
    const context = this.getContext(doc);
    const provider = this.hoverProviders.find((p) => p.canHover(context, location));
    if (!provider) return SKIP_CONTRIBUTION;
    return provider.hover(context, location);
  }

  async collectPropertyCompletions(
    uri: string,
    location: JSONPath,
    // Don't know what those three are for.
    _currentWord: string,
    _addValue: boolean,
    _isLast: boolean,
    result: CompletionsCollector,
  ): Promise<void> {
    const doc = this.documentManager.get(uri);
    if (!doc || doc.ast instanceof Error) return;

    const items = await Promise.all(
      this.completionProviders
        .filter((provider) => provider.completeProperty)
        .map((provider) => provider.completeProperty!(this.getContext(doc), location)),
    );

    for (const item of items.flat()) {
      result.add(item);
    }
  }

  async collectValueCompletions(
    uri: string,
    location: JSONPath,
    propertyKey: string,
    result: CompletionsCollector,
  ): Promise<void> {
    const doc = this.documentManager.get(uri);
    if (!doc || doc.ast instanceof Error) return;

    const items = await Promise.all(
      this.completionProviders
        .filter((provider) => provider.completeValue)
        .map((provider) =>
          provider.completeValue!(this.getContext(doc), location.concat(propertyKey)),
        ),
    );

    for (const item of items.flat()) {
      result.add(item);
    }
  }

  /** I'm not sure we want to do anything with that... but TS requires us to have it */
  async collectDefaultCompletions(_uri: string, _result: CompletionsCollector): Promise<void> {}

  private getContext(doc: AugmentedSourceCode): RequestContext {
    const context: RequestContext = {
      doc,
    };

    if (doc.type === SourceCodeType.LiquidHtml && !(doc.ast instanceof Error)) {
      const schema = findSchemaNode(doc.ast);
      if (!schema) return SKIP_CONTRIBUTION;
      const jsonString = schema?.source.slice(
        schema.blockStartPosition.end,
        schema.blockEndPosition.start,
      );
      context.schema = schema;
      context.parsed = parseJSON(jsonString);
    }

    return context;
  }
}
