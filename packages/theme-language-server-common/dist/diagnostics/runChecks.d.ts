import { CSSLanguageService } from '../css/CSSLanguageService';
import { DocumentManager } from '../documents';
import { Dependencies } from '../types';
import { DiagnosticsManager } from './DiagnosticsManager';
import { ThemeGraphManager } from '../server/ThemeGraphManager';
export declare function makeRunChecks(documentManager: DocumentManager, diagnosticsManager: DiagnosticsManager, { fs, loadConfig, themeDocset, jsonValidationSet, getMetafieldDefinitions, cssLanguageService, themeGraphManager, }: Pick<Dependencies, 'fs' | 'loadConfig' | 'themeDocset' | 'jsonValidationSet' | 'getMetafieldDefinitions'> & {
    cssLanguageService?: CSSLanguageService;
    themeGraphManager?: ThemeGraphManager;
}): (triggerURIs: string[]) => Promise<void>;
