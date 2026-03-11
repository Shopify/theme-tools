import { Connection, DidChangeWatchedFilesRegistrationOptions } from 'vscode-languageserver';
import { ClientCapabilities } from '../ClientCapabilities';
export declare const CHECK_ON_OPEN: "themeCheck.checkOnOpen";
export declare const CHECK_ON_SAVE: "themeCheck.checkOnSave";
export declare const CHECK_ON_CHANGE: "themeCheck.checkOnChange";
export declare const PRELOAD_ON_BOOT: "themeCheck.preloadOnBoot";
export declare const ConfigurationKeys: readonly ["themeCheck.checkOnOpen", "themeCheck.checkOnSave", "themeCheck.checkOnChange", "themeCheck.preloadOnBoot"];
export declare class Configuration {
    private connection;
    private capabilities;
    [CHECK_ON_OPEN]: boolean;
    [CHECK_ON_SAVE]: boolean;
    [CHECK_ON_CHANGE]: boolean;
    [PRELOAD_ON_BOOT]: boolean;
    constructor(connection: Connection, capabilities: ClientCapabilities);
    setup(): void;
    shouldCheckOnOpen(): Promise<boolean>;
    shouldCheckOnSave(): Promise<boolean>;
    shouldCheckOnChange(): Promise<boolean>;
    shouldPreloadOnBoot(): Promise<boolean>;
    clearCache(): void;
    fetchConfiguration: import("@shopify/theme-check-common").MemoedFunction<() => Promise<void>>;
    registerDidChangeCapability: import("@shopify/theme-check-common").MemoedFunction<() => Promise<import("vscode-languageserver").Disposable | undefined>>;
    registerDidChangeWatchedFilesNotification: (options?: DidChangeWatchedFilesRegistrationOptions) => Promise<import("vscode-languageserver").Disposable | undefined>;
}
