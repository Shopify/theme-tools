import { AbstractFileSystem, UriString, IsValidSchema, Mode } from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
import { AugmentedSourceCode } from './types';
export declare class DocumentManager {
    private readonly fs?;
    private readonly connection?;
    private readonly clientCapabilities?;
    private readonly getModeForUri?;
    private readonly isValidSchema?;
    /**
     * The sourceCodes map is a map of URIs to SourceCodes. It is used to keep
     * track of all the open documents in the workspace as well as caching the ASTs
     * of the documents.
     *
     * Files that are opened in the editor have a defined version, while files that
     * are preloaded have a version of `undefined`.
     */
    private sourceCodes;
    private recentlyRenamed;
    constructor(fs?: AbstractFileSystem | undefined, connection?: Connection | undefined, clientCapabilities?: ClientCapabilities | undefined, getModeForUri?: ((uri: UriString) => Promise<Mode>) | undefined, isValidSchema?: IsValidSchema | undefined);
    open(uri: UriString, source: string, version: number | undefined): void;
    change(uri: UriString, source: string, version: number | undefined): void;
    changeFromDisk(uri: UriString): Promise<void>;
    close(uri: UriString): void;
    delete(uri: UriString): boolean;
    rename(oldUri: UriString, newUri: UriString): void;
    theme(root: UriString, includeFilesFromDisk?: boolean): AugmentedSourceCode[];
    get openDocuments(): AugmentedSourceCode[];
    get(uri: UriString): AugmentedSourceCode | undefined;
    has(uri: UriString): boolean;
    /** Used to prevent cache busting twice for the same operation */
    hasRecentRename(uri: UriString): boolean;
    clearRecentRename(uri: UriString): void;
    private set;
    /**
     * The preload method is used to pre-load and pre-parse all the files in the
     * theme. It is smart and only will load files that are not already in the
     * DocumentManager.
     *
     * Files that are loaded from the AbstractFileSystem will have a version of `undefined`.
     */
    preload: {
        (rootUri: string): Promise<void>;
        force(rootUri: string): Promise<void>;
        invalidate(rootUri: string): void;
        clearCache(): void;
    };
    private augmentedSourceCode;
    /**
     * The workspace/onDidRenameFile notification is sent when a file is renamed in the workspace (via a user gesture)
     * The workspace/onDidChangeWatchedFiles notification is sent when a file is renamed on disk (via a file system event)
     *
     * The order is not guaranteed, but it seems to be true that onDidRenameFile happens before onDidChangeWatchedFiles.
     *
     * In the off-chance that the order is reversed, we'll have the sleep timer to clean up the state.
     */
    private trackRename;
}
