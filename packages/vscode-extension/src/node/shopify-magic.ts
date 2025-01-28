import {
  CancellationTokenSource,
  DecorationOptions,
  LanguageModelChatResponse,
  lm,
  MarkdownString,
  Position,
  Range,
  TextEditor,
  TextEditorDecorationType,
  window,
} from 'vscode';
import { buildMessages } from './shopify-magic-prompts';

/** A Shopify Magic decoration that provides code improvement suggestions */
export interface ShopifyMagicDecoration {
  /** The type defining the visual styling */
  type: TextEditorDecorationType;
  /** The options specifying where and how to render the suggestion */
  options: DecorationOptions;
}

/** Represents a suggestion for improving Liquid code */
export interface LiquidSuggestion {
  /** Line number where this suggestion starts */
  line: number;
  /** The range where this suggestion applies */
  range: Range;
  /** The improved code that should replace the existing code */
  newCode: string;
  /** Human-friendly explanation of the suggested improvement */
  suggestion: string;
}

const log = (msg?: any, ...opts: any[]) => console.error(`[Shopify Magic][Prompt] ${msg}`, ...opts);

export async function getShopifyMagicAnalysis(
  textEditor: TextEditor,
): Promise<ShopifyMagicDecoration[]> {
  const [model] = await lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o',
  });

  if (!model) {
    log('No language model available');
    return [];
  }

  try {
    const messages = await buildMessages(textEditor);
    const chatResponse = await model.sendRequest(messages, {}, new CancellationTokenSource().token);
    const jsonResponse = await parseChatResponse(chatResponse);

    if (!Array.isArray(jsonResponse?.suggestions)) {
      log('Invalid response from language model', jsonResponse);
      return [];
    }

    log(
      `Received response from language model with ${jsonResponse?.suggestions?.length} suggestions.`,
    );

    if (jsonResponse.suggestions.length === 0) {
      log(jsonResponse.reasonIfNoSuggestions ?? 'No suggestions provided');
      return [];
    }

    return jsonResponse.suggestions.flatMap(buildShopifyMagicDecoration.bind(null, textEditor));
  } catch (err) {
    log('Error during language model request', err);
  }

  return [];
}

function buildShopifyMagicDecoration(
  editor: TextEditor,
  liquidSuggestion: LiquidSuggestion,
): ShopifyMagicDecoration[] {
  const { suggestion, range } = liquidSuggestion;
  const type = createTextEditorDecorationType(suggestion);
  const line = Math.max(0, range.start.line - 1);
  const options = {
    range: new Range(
      new Position(line, 0),
      new Position(line, editor.document.lineAt(line).text.length),
    ),
    hoverMessage: createHoverMessage(type.key, liquidSuggestion),
  };

  return [{ type, options }];
}

async function parseChatResponse(chatResponse: LanguageModelChatResponse) {
  let accResponse = '';

  for await (const fragment of chatResponse.text) {
    accResponse += fragment;

    if (fragment.includes('}')) {
      try {
        const parsedResponse = JSON.parse(accResponse.replace('```json', ''));
        console.error(' parsedResponse >>>>>>>');
        console.error(JSON.stringify(parsedResponse, null, 2));
        console.error(' parsedResponse <<<<<<<');
        return parsedResponse;
      } catch (_err) {
        // ingore; next iteration
      }
    }
  }

  return [];
}

function createHoverMessage(key: string, liquidSuggestion: LiquidSuggestion) {
  const hoverUrlArgs = encodeURIComponent(JSON.stringify({ key, ...liquidSuggestion }));
  const hoverMessage = new MarkdownString(
    `#### ✨ Shopify Magic suggestion\n ${liquidSuggestion.suggestion}
    \n\n[Quick fix](command:shopifyLiquid.sidefix?${hoverUrlArgs})`,
  );

  hoverMessage.isTrusted = true;
  hoverMessage.supportHtml = true;

  return hoverMessage;
}

function createTextEditorDecorationType(text: string) {
  return window.createTextEditorDecorationType({
    after: {
      contentText: ` ✨ ${truncate(text, 120)}`,
      color: 'grey',
      fontStyle: 'italic',
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      border: '0; border-radius: 3px',
    },
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength).trim() + '...';
}
