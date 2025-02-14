import {
  CancellationTokenSource,
  DecorationOptions,
  LanguageModelChatMessage,
  LanguageModelChatResponse,
  lm,
  MarkdownString,
  Position,
  Range,
  TextEditor,
  TextEditorDecorationType,
  window,
} from 'vscode';
import {
  basePrompt,
  code,
  codeMetadata,
  liquidRules,
  themeArchitectureRules,
} from './shopify-magic-prompts';

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

const logger = (msg?: any, ...opts: any[]) => console.error(`[Shopify Magic] ${msg}`, ...opts);

export async function getShopifyMagicAnalysis(
  textEditor: TextEditor,
  log = logger,
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
    const jsonResponse = await parseChatResponse(chatResponse, log);

    if (!Array.isArray(jsonResponse?.suggestions)) {
      log('Invalid response from language model', jsonResponse);
      return [];
    }

    log(`Received ${jsonResponse?.suggestions?.length ?? 0} suggestions from language model`);
    if (jsonResponse.suggestions.length === 0) {
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

async function parseChatResponse(chatResponse: LanguageModelChatResponse, log = logger) {
  let accResponse = '';

  for await (const fragment of chatResponse.text) {
    accResponse += fragment;

    if (fragment.includes('}')) {
      try {
        const parsedResponse = JSON.parse(accResponse.replace('```json', ''));
        log('The language model response has been parsed:');
        log(JSON.stringify(parsedResponse, null, 2));
        log('--');
        return parsedResponse;
      } catch {
        // ingore; next iteration
      }
    }
  }

  return [];
}

async function buildMessages(textEditor: TextEditor) {
  const baseContext = basePrompt(textEditor);
  const codeContext = code(textEditor);
  const codeMetadataContext = codeMetadata(textEditor);
  const liquidRulesContext = await liquidRules();
  const themeArchitectureContext = themeArchitectureRules();

  return [
    baseContext,
    codeContext,
    codeMetadataContext,
    liquidRulesContext,
    themeArchitectureContext,
  ].map((message) => LanguageModelChatMessage.User(message));
}

function createHoverMessage(key: string, liquidSuggestion: LiquidSuggestion) {
  const hoverUrlArgs = encodeURIComponent(JSON.stringify({ key, ...liquidSuggestion }));
  const hoverMessage = new MarkdownString(
    `#### ✨ Shopify Magic suggestion\n ${liquidSuggestion.suggestion}
    \n\n[Quick fix](command:shopifyLiquid.magicFix?${hoverUrlArgs})`,
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
