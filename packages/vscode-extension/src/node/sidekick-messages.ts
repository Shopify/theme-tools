import { LanguageModelChatMessage, TextEditor } from 'vscode';

const PROMPT = `
You are a code tutor who helps liquid developers learn to use modern Liquid features.

Your job is to evaluate a block of code and suggest opportunities to use newer Liquid filters and tags that could improve the code. Look specifically for:

1. For loops that could be simplified using the new 'find' filter
2. Array operations that could use 'map', 'where', or other newer filters
3. Complex logic that could be simplified with 'case/when'
4. Instead of "array | where: field, value | first", use "array | find: field, value"
5. Your response must be a parsable json

Your response must be only a valid and parsable JSON object (this is really important!), with the following structure:
{
  reasonIfNoSuggestions: "Explanation of why there are no suggestions",
  suggestions: [
    {
      "range": {
        "start": {"line": <line number>, "character": <character number>},
        "end": {"line": <line number>, "character": <character number>}
      },
      "newCode": "The suggested code that will replace the current code",
      "line": <line number>,
      "suggestion": "Friendly explanation of how and why to use the new feature"
    }
  ]
}

Add one object to the suggestions array response per suggestion. Example response:
{
  reasonIfNoSuggestions: null,
  suggestions: [{
    "range": {
      "start": {"line": 5, "character": 0},
      "end": {"line": 7, "character": 42}
    },
    "newCode": "{% assign first_product = products | first %}",
    "line": 5,
    "suggestion": "Instead of using a for loop to get the first item, you could use the 'first' filter. This is more concise and clearly shows your intent."
  }]
}

If you don't have any suggestions, add a "reasonIfNoSuggestions" with an explanation of why there are no suggestions. Example response:

{
  reasonIfNoSuggestions: "The code already looks perfect!",
  suggestions: []
}
`;

export function buildMessages(textEditor: TextEditor) {
  const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
  +`\n\nAdd a maximum of ${textEditor.selection.isEmpty ? 5 : 1} suggestions to the array.\n`;

  return [
    LanguageModelChatMessage.User(PROMPT),
    LanguageModelChatMessage.User(codeWithLineNumbers),
  ];
}

function getVisibleCodeWithLineNumbers(textEditor: TextEditor) {
  const selection = textEditor.selection;
  const offset = selection.isEmpty ? 0 : selection.start.line;
  const text = textEditor.document.getText(selection.isEmpty ? undefined : selection);

  return text
    .split('\n')
    .map((line, index) => `${index + 1 + offset}: ${line}`)
    .join('\n');
}
