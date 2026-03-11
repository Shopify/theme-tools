import { LanguageService } from 'vscode-css-languageservice';
export type CSSLanguageServices = Record<'css' | 'less' | 'scss', LanguageService>;
export declare function getCssLanguageService(kind: 'css'): LanguageService;
