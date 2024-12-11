import { LanguageModelChatMessage, TextEditor } from 'vscode';

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

export function buildMessages(textEditor: TextEditor) {
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
