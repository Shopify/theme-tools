import { Connection } from 'vscode-languageserver';
import { Dependencies } from '../types';
/**
 * This code runs in node and the browser, it can't talk to the file system
 * or make requests. Stuff like that should be injected.
 *
 * In browser, theme-check-js wants these things:
 *   - fileExists(path)
 *   - defaultTranslations
 *
 * Which means we gotta provide 'em from here too!
 */
export declare function startServer(connection: Connection, { fs: injectedFs, loadConfig: injectedLoadConfig, log, jsonValidationSet, themeDocset: remoteThemeDocset, fetchMetafieldDefinitionsForURI, }: Dependencies): void;
