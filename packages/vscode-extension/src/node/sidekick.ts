import {
  CancellationTokenSource,
  DecorationOptions,
  LanguageModelChatMessage,
  LanguageModelChatResponse,
  lm,
  MarkdownString,
  Position,
  Range,
  TextDocument,
  TextEditor,
  TextEditorDecorationType,
  window,
} from 'vscode';

const PROMPT = `You are a code tutor who helps liquid developers learn to use modern Liquid features.

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

function getVisibleCodeWithLineNumbers(textEditor: TextEditor) {
  let code = '';

  const lines = textEditor.document.getText().split('\n');

  for (let i = 0; i < lines.length; i++) {
    code += `${i + 1}: ${lines[i]}\n`;
  }

  return code;
}

export async function showSidekickTipsDecoration(textEditor: TextEditor) {
  let [model] = await lm.selectChatModels({
    vendor: 'copilot',
    family: 'gpt-4o',
  });

  const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);

  const messages = [
    LanguageModelChatMessage.User(PROMPT),
    LanguageModelChatMessage.User(codeWithLineNumbers),
  ];

  if (model) {
    try {
      let chatResponse = await model.sendRequest(messages, {}, new CancellationTokenSource().token);

      const jsonResponse = await parseChatResponse(chatResponse);

      applyDecoration(textEditor, jsonResponse);
    } catch (e) {
      console.error('Error during GPT-4o request', e);
    }
  }
}

async function parseChatResponse(chatResponse: LanguageModelChatResponse) {
  let accResponse = '';

  for await (const fragment of chatResponse.text) {
    accResponse += fragment;
    if (fragment.includes('}')) {
      try {
        console.error('parse try', accResponse);
        const response = JSON.parse(accResponse.replace('```json', ''));

        console.error('parse success', response);
        return response;
      } catch (e) {
        // ingore; next iteration
      }
    }
  }
}

function applyDecoration(
  editor: TextEditor,
  annotation: {
    range: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    newCode: string;
    line: number;
    suggestion: string;
  },
) {
  const decorationType = window.createTextEditorDecorationType({
    after: {
      contentText: `✨ ${annotation.suggestion.substring(0, 120) + '...'}`,
      color: 'grey',
      fontStyle: 'italic',
    },
  });

  const commandArgs = {
    range: annotation.range,
    newCode: annotation.newCode,
  };

  const hoverMessage = new MarkdownString(
    `${annotation.suggestion}
    \n\n[Quick fix](command:code-tutor.applySuggestion?${encodeURIComponent(
      JSON.stringify(commandArgs),
    )})`,
  );

  hoverMessage.isTrusted = true;
  hoverMessage.supportHtml = true;

  const range = new Range(
    new Position(annotation.range.start.line - 2, 0),
    new Position(
      annotation.range.start.line - 2,
      editor.document.lineAt(annotation.range.start.line - 2).text.length,
    ),
  );

  const decoration: DecorationOptions = {
    range: range,
    hoverMessage,
  };

  editor.setDecorations(decorationType, [decoration]);
}
