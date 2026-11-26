import {
  BlockMarkup,
  LiquidHtmlNode,
  LiquidVariableLookup,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { BLOCK_CONTENT_PARAMETER, BlockParameter, Translations } from '@shopify/theme-check-common';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupKind,
  Range,
  TextEdit,
} from 'vscode-languageserver';
import { AugmentedLiquidSourceCode } from '../../documents';
import { GetTranslationsForURI } from '../../translations';
import {
  formatBlockParameter,
  getBlockParameterTranslations,
  GetBlockParametersForURI,
} from '../../utils/blockParameters';
import { getParameterCompletionTemplate } from '../../utils/liquidDoc';
import { LiquidCompletionParams } from '../params';
import { Provider } from './common';

/**
 * Offers the target block's parameters as named arguments of a `block` tag:
 * schema setting IDs, LiquidDoc parameters, and the built-in `content`.
 *
 * @example {% block 'card', █ %}
 */
export class BlockParameterCompletionProvider implements Provider {
  constructor(
    private readonly getBlockParametersForURI: GetBlockParametersForURI,
    private readonly getSchemaTranslationsForURI: GetTranslationsForURI,
  ) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;
    const blockMarkup = ancestors.at(-1);
    if (node?.type !== NodeTypes.VariableLookup || node.lookups.length > 0) return [];
    if (blockMarkup?.type !== NodeTypes.BlockMarkup) return [];

    const parameters = await this.getBlockParametersForURI(
      params.textDocument.uri,
      blockMarkup.name.value,
    );
    if (!parameters) return [];

    const partial = node.name ?? '';
    const unavailableNames = providedArgumentNames(node, blockMarkup, ancestors.at(-2));

    const available = [...parameters.values()].filter(
      ({ name }) => name.startsWith(partial) && !unavailableNames.has(name),
    );
    const translations = await getBlockParameterTranslations(
      this.getSchemaTranslationsForURI,
      params.textDocument.uri,
      available,
    );

    return available.map((parameter) =>
      toCompletionItem(parameter, translations, node, params.document),
    );
  }
}

/**
 * The names the call already provides, except the argument name being typed
 * over. A non-empty parsed body provides `content`.
 */
function providedArgumentNames(
  node: LiquidVariableLookup,
  blockMarkup: BlockMarkup,
  blockTag: LiquidHtmlNode | undefined,
): Set<string> {
  const names = blockMarkup.args.filter((arg) => !isTypedOver(arg, node)).map((arg) => arg.name);

  if (blockTag?.type === NodeTypes.LiquidTag && blockTag.children?.length) {
    names.push(BLOCK_CONTENT_PARAMETER);
  }

  return new Set(names);
}

function isTypedOver(arg: BlockMarkup['args'][number], node: LiquidVariableLookup): boolean {
  return node.name !== '' && arg.position.start === node.position.start;
}

function toCompletionItem(
  parameter: BlockParameter,
  translations: Translations,
  node: LiquidVariableLookup,
  document: AugmentedLiquidSourceCode,
): CompletionItem {
  const { textEdit, insertTextFormat } = argumentNameEdit(parameter, node, document);

  return {
    label: parameter.name,
    kind: CompletionItemKind.Property,
    documentation: {
      kind: MarkupKind.Markdown,
      value: formatBlockParameter(parameter, translations),
    },
    insertTextFormat,
    textEdit,
  };
}

/**
 * Builds the edit for one argument-name slot:
 *   - empty slot (`, █`): insert `name: value`, plus a comma before an
 *     argument that follows;
 *   - existing argument name (`ti█tle: 'x'`): replace only the name;
 *   - partial name (`ti█`): replace the partial with `name: value`.
 */
function argumentNameEdit(
  parameter: BlockParameter,
  node: LiquidVariableLookup,
  document: AugmentedLiquidSourceCode,
): { textEdit: TextEdit; insertTextFormat: InsertTextFormat } {
  const { source, textDocument } = document;
  const template = getParameterCompletionTemplate(parameter.name, parameter.type ?? null);
  const remainingText = source.slice(node.position.end);

  if (node.name === '') {
    const cursor = textDocument.positionAt(node.position.end);
    return {
      textEdit: TextEdit.insert(cursor, template + followingArgumentSeparator(remainingText)),
      insertTextFormat: InsertTextFormat.Snippet,
    };
  }

  const nameSuffix = remainingText.match(/^[\w-]*/)![0];
  const range = Range.create(
    textDocument.positionAt(node.position.start),
    textDocument.positionAt(node.position.end + nameSuffix.length),
  );

  if (/^\s*:/.test(remainingText.slice(nameSuffix.length))) {
    return {
      textEdit: TextEdit.replace(range, parameter.name),
      insertTextFormat: InsertTextFormat.PlainText,
    };
  }

  return {
    textEdit: TextEdit.replace(range, template),
    insertTextFormat: InsertTextFormat.Snippet,
  };
}

function followingArgumentSeparator(remainingText: string): string {
  if (/^[a-zA-Z_]/.test(remainingText)) return ', ';
  if (/^\s+[a-zA-Z_]/.test(remainingText)) return ',';
  return '';
}
