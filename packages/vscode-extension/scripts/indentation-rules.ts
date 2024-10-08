import { BLOCKS } from '@shopify/liquid-html-parser';
import { decreaseIndentTags, increaseIndentTags, voidElements } from './constants';

export interface IndentationRulesJSON {
  increaseIndentPattern: string;
  decreaseIndentPattern: string;
}

// https://regex101.com/r/G4OYnb/1
export function increaseIndentPattern() {
  const patterns = [
    // Opening HTML tags that are not self closing. Here we use a negative
    // lookahead (?!) to make sure that the next character after < is not /
    // or one of the void elements or a start comment.
    String.raw`<(?!\/|${voidElements.join('|')}|!--)[^>\n]+>`,

    // Opening liquid tags that have a corresponding end$name tag.
    String.raw`{%-?\s+(?:${increaseIndentTags.join('|')})[^}%]*?-?%}`, // opening liquid tags

    // Multiline HTML comment open
    String.raw`<!--[^>\n]*`,

    // Multiline HTML tag not closed
    String.raw`<(?!\/)[^>\n]+`,

    // Tag start not closed
    String.raw`{%(?:(?!%}).)*`,

    // Variable start not closed
    String.raw`{{(?:(?!}}).)*`,

    // Opening Brace Not Closed
    String.raw`{(?:(?!}).)*`,
    String.raw`\[(?:(?!\]).)*`,
    String.raw`\((?:(?!\)).)*`,

    // Closing tag (this technically means multiline void elements must be
    // closed, but I couldn't find a better way to do this.)
    String.raw`^\s*>`,
  ];

  // The line must end by one of those patterns
  return String.raw`(${patterns.join('|')})$`;
}

export function decreaseIndentPattern() {
  const patterns = [
    // Closing HTML tags
    String.raw`<\/[^>]+>`,

    // Closing liquid tags
    String.raw`{%-?\s+(?:${decreaseIndentTags.join('|')}).*?-?%}`, // opening liquid tags

    // Multiline tag closed
    String.raw`%}`,

    // Multiline variable closed
    String.raw`}}`,

    // Multiline HTML tag closed
    String.raw`>`,

    // Multiline self-closing HTML tag closed
    String.raw`\/>`,

    // Multiline HTML block comment closed
    String.raw`-->`,

    // Multiline Closing Braces (JS/CSS)
    String.raw`}`,
    String.raw`\)`,
    String.raw`\]`,
  ];

  // The line must start by one of those patterns
  return String.raw`^\s*(${patterns.join('|')})`;
}

export async function indentationRules(): Promise<IndentationRulesJSON> {
  return {
    increaseIndentPattern: increaseIndentPattern(),
    decreaseIndentPattern: decreaseIndentPattern(),
  };
}
