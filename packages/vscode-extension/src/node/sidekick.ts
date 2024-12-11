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

const PROMPT = `
You are a code tutor who helps liquid developers learn to use modern Liquid features.

Your job is to evaluate a block of code and suggest opportunities to use newer Liquid filters and tags that could improve the code. Look specifically for:

1. For loops that could be simplified using the new 'find' filter
2. Array operations that could use 'map', 'where', or other newer filters
3. Complex logic that could be simplified with 'case/when'
4. Instead of "array | where: field, value | first", use "array | find: field, value"
5. Your response must be a parsable json

Your response must be only a valid and parsable JSON object (this is really important!) with the following structure:
{
  "range": {
    "start": {"line": <line number>, "character": <character number>},
    "end": {"line": <line number>, "character": <character number>}
  },
  "newCode": "The suggested code that will replace the current code",
  "line": <line number>,
  "suggestion": "Friendly explanation of how and why to use the new feature"
}

Example respons:
{
  "range": {
    "start": {"line": 5, "character": 0},
    "end": {"line": 7, "character": 42}
  },
  "newCode": "{% assign first_product = products | first %}",
  "line": 5,
  "suggestion": "Instead of using a for loop to get the first item, you could use the 'first' filter. This is more concise and clearly shows your intent."
}
`;

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
    console.error('[Sidekick] Error during language model request', err);
  }

  return [];
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
}

function buildSidekickDecorations(
  editor: TextEditor,
  suggestion: LiquidSuggestion,
): SidekickDecoration[] {
  const type = window.createTextEditorDecorationType({
    after: {
      contentText: `✨ ${suggestion.suggestion.substring(0, 120) + '...'}`,
      color: 'grey',
      fontStyle: 'italic',
    },
  });

  const range = new Range(
    new Position(suggestion.range.start.line - 2, 0),
    new Position(
      suggestion.range.start.line - 2,
      editor.document.lineAt(suggestion.range.start.line - 2).text.length,
    ),
  );

  const options: DecorationOptions = {
    range: range,
    hoverMessage: createHoverMessage(suggestion),
  };

  return [{ type, options }];
}

function createHoverMessage(suggestion: LiquidSuggestion) {
  const hoverUrlArgs = encodeURIComponent(JSON.stringify(suggestion));
  const hoverMessage = new MarkdownString(
    `${suggestion.suggestion}
    \n\n[Quick fix](command:shopifyLiquid.sidefix?${hoverUrlArgs})`,
  );

  hoverMessage.isTrusted = true;
  hoverMessage.supportHtml = true;

  return hoverMessage;
}

function buildMessages(textEditor: TextEditor) {
  const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);

  return [
    LanguageModelChatMessage.User(PROMPT),
    LanguageModelChatMessage.User(codeWithLineNumbers),
  ];
}

function getVisibleCodeWithLineNumbers(textEditor: TextEditor) {
  return textEditor.document
    .getText()
    .split('\n')
    .map((line, index) => `${index + 1}: ${line}`)
    .join('\n');
}
