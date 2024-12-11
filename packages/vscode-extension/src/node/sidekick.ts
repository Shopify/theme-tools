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
import { buildMessages } from './sidekick-messages';

/** A sidekick decoration that provides code improvement suggestions */
export interface SidekickDecoration {
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

export async function getSidekickAnalysis(textEditor: TextEditor): Promise<SidekickDecoration[]> {
  const [model] = await lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o',
  });

  if (!model) {
    return [];
  }

  try {
    const messages = buildMessages(textEditor);
    const chatResponse = await model.sendRequest(messages, {}, new CancellationTokenSource().token);
    const jsonResponse = await parseChatResponse(chatResponse);

    return buildSidekickDecorations(textEditor, jsonResponse);
  } catch (err) {
    log('Error during language model request', err);
  }

  return [];
}

function buildSidekickDecorations(
  editor: TextEditor,
  liquidSuggestion: LiquidSuggestion,
): SidekickDecoration[] {
  const { suggestion, range } = liquidSuggestion;
  const type = createTextEditorDecorationType(suggestion.substring(0, 120));
  const line = range.start.line - 2;
  const options = {
    range: new Range(
      new Position(line, 0),
      new Position(line, editor.document.lineAt(line).text.length),
    ),
    hoverMessage: createHoverMessage(liquidSuggestion),
  };

  return [{ type, options }];
}

async function parseChatResponse(chatResponse: LanguageModelChatResponse) {
  let accResponse = '';

  for await (const fragment of chatResponse.text) {
    accResponse += fragment;

    if (fragment.includes('}')) {
      try {
        return JSON.parse(accResponse.replace('```json', ''));
      } catch (_err) {
        // ingore; next iteration
      }
    }
  }

  return [];
}

export function log(message?: any, ...optionalParams: any[]) {
  console.error(` [Sidekick] ${message}`, ...optionalParams);
}

export function buildAnalyzingDecoration(editor: TextEditor): SidekickDecoration {
  const type = createTextEditorDecorationType('Analyzing');

  const position = editor.selection.active;
  const options = { range: new Range(position, position) };

  return { type, options };
}

function createHoverMessage(liquidSuggestion: LiquidSuggestion) {
  const hoverUrlArgs = encodeURIComponent(JSON.stringify(liquidSuggestion));
  const hoverMessage = new MarkdownString(
    `${liquidSuggestion.suggestion}
    \n\n[Quick fix](command:shopifyLiquid.sidefix?${hoverUrlArgs})`,
  );

  hoverMessage.isTrusted = true;
  hoverMessage.supportHtml = true;

  return hoverMessage;
}

function createTextEditorDecorationType(text: string) {
  return window.createTextEditorDecorationType({
    after: {
      contentText: ` ✨ ${text}...`,
      color: 'grey',
      fontStyle: 'italic',
    },
  });
}
