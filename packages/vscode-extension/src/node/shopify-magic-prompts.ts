import { LanguageModelChatMessage, TextEditor } from 'vscode';
import { themeArchitectureRules } from './shopify-magic-prompts/theme-architecture';
import { liquidRules } from './shopify-magic-prompts/liquid';
import { basePrompt, code, codeMetadata } from './shopify-magic-prompts/base';

export async function buildMessages(textEditor: TextEditor) {
  const prompt = [
    basePrompt(textEditor),
    code(textEditor),
    codeMetadata(textEditor),
    await liquidRules(),
    themeArchitectureRules(),
  ];

  return prompt.map((message) => LanguageModelChatMessage.User(message));
}
