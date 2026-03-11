import { AbstractFileSystem } from '@shopify/theme-check-common';
import { buildThemeGraph, Location } from '@shopify/theme-graph';
import { Connection } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { AugmentedLocation, AugmentedReference } from '../types';
import { FindThemeRootURI } from '../internal-types';
export declare class ThemeGraphManager {
    private connection;
    private documentManager;
    private fs;
    private findThemeRootURI;
    graphs: Map<string, ReturnType<typeof buildThemeGraph>>;
    constructor(connection: Connection, documentManager: DocumentManager, fs: AbstractFileSystem, findThemeRootURI: FindThemeRootURI);
    getThemeGraphForURI(uri: string): Promise<import("@shopify/theme-graph").ThemeGraph | undefined>;
    getReferences(uri: string, offset?: number, { includeIndirect, includePreset }?: {
        includeIndirect?: boolean | undefined;
        includePreset?: boolean | undefined;
    }): Promise<AugmentedReference[]>;
    getDependencies(uri: string, offset?: number, { includeIndirect, includePreset }?: {
        includeIndirect?: boolean | undefined;
        includePreset?: boolean | undefined;
    }): Promise<AugmentedReference[]>;
    augmentedLocation(loc: Location): Promise<AugmentedLocation>;
    deadCode(rootUri: string): Promise<string[]>;
    operationQueue: string[];
    rename(oldUri: string, newUri: string): Promise<void>;
    change(uri: string): Promise<void>;
    create(uri: string): Promise<void>;
    delete(uri: string): Promise<void>;
    private processQueue;
    private buildThemeGraph;
    private getSourceCode;
    private getWebComponentMap;
    private graphDependencies;
}
