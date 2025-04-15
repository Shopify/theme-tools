import { LiquidVariableLookup, NodeTypes } from '@shopify/liquid-html-parser';
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  TextEdit,
} from 'vscode-languageserver';
import { CURSOR, LiquidCompletionParams } from '../params';
import { Provider } from './common';
import { AugmentedLiquidSourceCode } from '../../documents';
import { DEFAULT_COMPLETION_OPTIONS } from './data/contentForParameterCompletionOptions';
import { DocDefinition, GetDocDefinitionForURI } from '@shopify/theme-check-common';
import { getParameterCompletionTemplate } from '../../utils/liquidDoc';

/**
 * Offers completions for parameters for the `content_for` tag after a user has
 * specificied the type.
 *
 * @example {% content_for "block", █ %}
 */
export class ContentForParameterCompletionProvider implements Provider {
  constructor(private readonly getDocDefinitionForURI: GetDocDefinitionForURI) {}

  async completions(params: LiquidCompletionParams): Promise<CompletionItem[]> {
    if (!params.completionContext) return [];

    const { node, ancestors } = params.completionContext;

    const parentNode = ancestors.at(-1);

    const parentIsContentFor = parentNode?.type == NodeTypes.ContentForMarkup;
    const nodeIsVariableLookup = node?.type == NodeTypes.VariableLookup;

    if (!parentIsContentFor || !nodeIsVariableLookup) {
      return [];
    }

    if (!node.name || node.lookups.length > 0) {
      return [];
    }

    const completionItems = this.staticCompletions(
      node,
      parentNode.contentForType.value == 'blocks',
      params.document,
    );

    if (parentNode.contentForType.value === 'block') {
      const typeArg = parentNode.args.find((arg) => arg.name === 'type')?.value;

      if (typeArg?.type === NodeTypes.String) {
        const snippetDefinition = await this.getDocDefinitionForURI(
          params.textDocument.uri,
          'blocks',
          typeArg.value,
        );

        completionItems.push(
          ...this.liquidDocParameterCompletions(node, params.document, snippetDefinition),
        );
      }
    }

    // We need to find out existing params in the content_for tag so we don't offer it again for completion
    const existingParams = parentNode.args
      .filter((arg) => arg.type === NodeTypes.NamedArgument)
      .map((arg) => arg.name);

    return completionItems.filter((item) => !existingParams.includes(item.label));
  }

  textEdit(
    node: LiquidVariableLookup,
    document: AugmentedLiquidSourceCode,
    name: string,
    textTemplate: string = `${name}: '$1'`,
  ): {
    textEdit: TextEdit;
    format: InsertTextFormat;
  } {
    const remainingText = document.source.slice(node.position.end);

    // Match all the way up to the termination of the parameter which could be
    // another parameter (`,`), filter (`|`), or the end of a liquid statement.
    const match = remainingText.match(/^(.*?)\s*(?=,|\||-?\}\}|-?\%\})|^(.*)$/);
    const offset = match ? match[0].trimEnd().length : remainingText.length;
    const existingParameterOffset = remainingText.match(/[^a-zA-Z]/)?.index ?? remainingText.length;

    let start = document.textDocument.positionAt(node.position.start);
    let end = document.textDocument.positionAt(node.position.end + offset);
    let newText = name === 'closest' ? `${name}.` : textTemplate;
    let format = name === 'closest' ? InsertTextFormat.PlainText : InsertTextFormat.Snippet;

    // If the cursor is inside the parameter or at the end and it's the same
    // value as the one we're offering a completion for then we want to restrict
    // the insert to just the name of the parameter.
    // e.g. `{% content_for "block", t█ype: "button" %}` and we're offering `type`
    if (node.name + remainingText.slice(0, existingParameterOffset) == name) {
      newText = name;
      format = InsertTextFormat.PlainText;
      end = document.textDocument.positionAt(node.position.end + existingParameterOffset);
    }

    // If the cursor is at the beginning of the string we can consider all
    // options and should not replace any text.
    // e.g. `{% content_for "block", █type: "button" %}`
    // e.g. `{% content_for "block", █ %}`
    if (node.name === CURSOR) {
      end = start;

      // If we're inserting text in front of an existing parameter then we need
      // to add a comma to separate them.
      if (existingParameterOffset > 0) {
        newText += ', ';
      }
    }

    return {
      textEdit: TextEdit.replace(
        {
          start,
          end,
        },
        newText,
      ),
      format,
    };
  }

  private staticCompletions(
    node: LiquidVariableLookup,
    isTypeBlocks: boolean,
    document: AugmentedLiquidSourceCode,
  ) {
    let options = DEFAULT_COMPLETION_OPTIONS;

    const partial = node.name!.replace(CURSOR, '');

    if (isTypeBlocks) {
      options = {
        closest: DEFAULT_COMPLETION_OPTIONS.closest,
      };
    }

    return Object.entries(options)
      .filter(([keyword, _description]) => keyword.startsWith(partial))
      .map(([keyword, description]): CompletionItem => {
        const { textEdit, format } = this.textEdit(node, document, keyword);
        return {
          label: keyword,
          kind: CompletionItemKind.Keyword,
          documentation: {
            kind: 'markdown',
            value: description,
          },
          insertTextFormat: format,
          textEdit,
        };
      });
  }

  private liquidDocParameterCompletions(
    node: LiquidVariableLookup,
    document: AugmentedLiquidSourceCode,
    docDefinition?: DocDefinition,
  ) {
    return (docDefinition?.liquidDoc?.parameters || []).map((liquidDocParam): CompletionItem => {
      const { textEdit, format } = this.textEdit(
        node,
        document,
        liquidDocParam.name,
        getParameterCompletionTemplate(liquidDocParam.name, liquidDocParam.type),
      );

      return {
        label: liquidDocParam.name,
        kind: CompletionItemKind.Keyword,
        documentation: {
          kind: 'markdown',
          value: liquidDocParam.description || '',
        },
        insertTextFormat: format,
        textEdit,
      };
    });
  }
}
