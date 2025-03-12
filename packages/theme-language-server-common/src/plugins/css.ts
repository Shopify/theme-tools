import { getCSSLanguageService, LanguageService } from 'vscode-css-languageservice';

const cssLanguageService = getCSSLanguageService();

const languageServices = {
  css: cssLanguageService,
};
export type CSSLanguageServices = Record<'css' | 'less' | 'scss', LanguageService>;

export function getCssLanguageService(kind: 'css'): LanguageService {
  return languageServices[kind];
}
