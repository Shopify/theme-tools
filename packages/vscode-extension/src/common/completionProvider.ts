/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */

import {
  InlineCompletionContext,
  InlineCompletionItem,
  InlineCompletionItemProvider,
  LanguageModelChatMessage,
  lm,
  Position,
  Range,
  TextDocument,
} from 'vscode';
import { CancellationToken, CancellationTokenSource } from 'vscode-languageclient';

const ANNOTATION_PROMPT = `You are a code tutor who helps liquid developers learn to use modern Liquid features.

Your job is to evaluate a block of code and suggest opportunities to use newer Liquid filters and tags that could improve the code. Look specifically for:

1. For loops that could be simplified using the new 'find' filter
2. Array operations that could use 'map', 'where', or other newer filters
3. Complex logic that could be simplified with 'case/when'
4. Instead of "array | where: field, value | first", use "array | find: field, value"
5. Your response must be a parsable json

Format your response as a JSON object with the following structure:
{
  "range": {
    "start": {"line": <line number>, "character": <character number>},
    "end": {"line": <line number>, "character": <character number>}
  },
  "newCode": "The suggested code that will replace the current code",
  "line": <line number>,
  "suggestion": "Friendly explanation of how and why to use the new feature"
}

Example respons ():
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

export default class LiquidCompletionProvider implements InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: TextDocument,
    _position: Position,
    _context: InlineCompletionContext,
    _token: CancellationToken,
  ) {
    console.error('[SERVER] inline completion');

    let [model] = await lm.selectChatModels({
      vendor: 'copilot',
      family: 'gpt-4o',
    });

    function getVisibleCodeWithLineNumbers(document: TextDocument) {
      let code = '';
      const lines = document.getText().split('\n');
      for (let i = 0; i < lines.length; i++) {
        code += `${i + 1}: ${lines[i]}\n`;
      }
      return code;
    }

    const codeWithLineNumbers = getVisibleCodeWithLineNumbers(document);

    const messages = [
      LanguageModelChatMessage.User(ANNOTATION_PROMPT),
      LanguageModelChatMessage.User(codeWithLineNumbers),
    ];

    let accumulatedResponse = '';
    let annotation: any = {};

    if (model) {
      let chatResponse = await model.sendRequest(messages, {}, new CancellationTokenSource().token);

      for await (const fragment of chatResponse.text) {
        accumulatedResponse += fragment;

        if (fragment.includes('}')) {
          try {
            annotation = JSON.parse(accumulatedResponse.replace('```json', ''));
            accumulatedResponse = '';
          } catch (e) {}
        }
      }
    }

    // const range = new Range(
    //   new Position(annotation.range.start.line - 1, annotation.range.start.character),
    //   new Position(annotation.range.end.line - 1, annotation.range.end.character),
    // );

    return [new InlineCompletionItem(annotation.newCode)];
  }
}
