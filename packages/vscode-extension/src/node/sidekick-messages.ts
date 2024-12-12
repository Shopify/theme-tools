/* eslint-disable @typescript-eslint/naming-convention */

import { LanguageModelChatMessage, TextEditor } from 'vscode';

interface ThemeDirectory {
  summary: string;
}

export function buildMessages(textEditor: TextEditor) {
  console.error('>>>>>>>', textEditor.document.fileName);

  const fileType = getFileType(textEditor.document.fileName);

  console.error(' type >>>>>>>', fileType);

  const newLocal = [basePrompt(textEditor), code(textEditor), themeArchitecture()];

  console.error(' message >>>>>>>');
  console.error(newLocal.join('\n'));
  console.error(' message <<<<<<<');

  return newLocal.map((message) => LanguageModelChatMessage.User(message));
}

function basePrompt(textEditor: TextEditor): string {
  return `
    You are Sidekick, an AI assistant designed to help Liquid developers optimize Shopify themes.

    Your goal is to identify and suggest opportunities for improvement in the "## CODE", focusing on the following areas:

    - Enhancing readability, conciseness, and efficiency while maintaining the same functionality
    - Leveraging new features in Liquid, including filters, tags, and objects
    - Adhering to best practices recommended for Shopify theme development with Liquid

    Ensure the suggestions are specific, actionable, and align with the best practices in Liquid and Shopify theme development.

    Use the "## THEME ARCHITECTURE", the "## DOCS SUMMARY", and Shopify.dev context. Do not make up new information.

    Add a maximum of ${textEditor.selection.isEmpty ? 5 : 1} suggestions to the array.\n

    Your response must be exclusively a valid and parsable JSON object with the following structure:

    {
      "reasonIfNoSuggestions": "Explanation of why there are no suggestions",
      "suggestions": [
        {
          "newCode": "<string: the improved code to replace the current code>",
          "range": {
            "start": {
              "line": <number: start line where the new code starts>,
              "character": <number: start character where the new code starts>
            },
            "end": {
              "line": <number: end line where the new code ends>,
              "character": <number: end character where the new code ends>
            }
          },
          "line": <number: line for the suggestion>,
          "suggestion": "<string: up to 60 chars explanation of the improvement and its benefits>"
        }
      ]
    }

    Example of valid response:

    {
      "reasonIfNoSuggestions": null,
      "suggestions": [
        {
          "newCode": "{% assign first_product = products | first %}",
          "range": {
            "start": {
              "line": 5,
              "character": 0
            },
            "end": {
              "line": 7,
              "character": 42
            }
          },
          "line": 5,
          "suggestion": "Instead of using a for loop to get the first item, you could use the 'first' filter. This is more concise and clearly shows your intent."
        }
      ]
    }
  `;
}

function themeArchitecture(): string {
  return `
    ## THEME ARCHITECTURE

    ${Object.entries(THEME_ARCHITECTURE)
      .map(([key, value]) => `- ${key}: ${value.summary}`)
      .join('\n\n')}
  `;
}

function code(textEditor: TextEditor) {
  const selection = textEditor.selection;
  const offset = selection.isEmpty ? 0 : selection.start.line;
  const text = textEditor.document.getText(selection.isEmpty ? undefined : selection);

  return `
    ## CODE

    ${text
      .split('\n')
      .map((line, index) => `${index + 1 + offset}: ${line}`)
      .join('\n')}
  `;
}

function getFileType(path: string): string {
  const pathWithoutFile = path.substring(0, path.lastIndexOf('/'));
  const fileTypes = Object.keys(THEME_ARCHITECTURE);

  return fileTypes.find((type) => pathWithoutFile.endsWith(type)) || 'none';
}

const THEME_ARCHITECTURE: { [key: string]: ThemeDirectory } = {
  assets: {
    summary: `Contains static files such as CSS, JavaScript, and images. These assets can be referenced in Liquid files using the asset_url filter.`,
  },
  sections: {
    summary: `Liquid files that define customizable sections of a page. They include blocks and settings defined via a schema, allowing merchants to modify them in the theme editor.`,
  },
  blocks: {
    summary: `Configurable elements within sections that can be added, removed, or reordered. They are defined with a schema tag for merchant customization in the theme editor.`,
  },
  config: {
    summary: `Holds settings data and schema for theme customization options like typography and colors, accessible through the Admin theme editor.`,
  },
  layout: {
    summary: `Defines the structure for repeated content such as headers and footers, wrapping other template files.`,
  },
  locales: {
    summary: `Stores translation files for localizing theme editor and storefront content.`,
  },
  snippets: {
    summary: `Reusable code fragments included in templates, sections, and layouts via the render tag. Ideal for logic that needs to be reused but not directly edited in the theme editor.`,
  },
  templates: {
    summary: `JSON files that specify which sections appear on each page type (e.g., product, collection, blog). They are wrapped by layout files for consistent header/footer content.`,
  },
  'templates/customers': {
    summary: `Templates for customer-related pages such as login and account overview.`,
  },
  'templates/metaobject': {
    summary: `Templates for rendering custom content types defined as metaobjects.`,
  },
};

// const PROMPT = `
// You are a teacher who helps liquid developers learn to use modern Liquid features.

// Your job is to evaluate a block of code and suggest opportunities to use newer Liquid filters and tags that could improve the code. Look specifically for:

// 1. For loops that could be simplified using the new 'find' filter
// 2. Array operations that could use 'map', 'where', or other newer filters
// 3. Complex logic that could be simplified with 'case/when'
// 4. Instead of "array | where: field, value | first", use "array | find: field, value"
// 5. Your response must be a parsable json

// Add one object to the suggestions array response per suggestion.

// If you don't have any suggestions, add a "reasonIfNoSuggestions" with an explanation of why there are no suggestions. Example response:

// {
//   reasonIfNoSuggestions: "The code already looks perfect!",
//   suggestions: []
// }
// `;
