import { Config, JSONSourceCode, LiquidSourceCode, Offense, Theme } from '@shopify/theme-check-common';
import { loadConfig as resolveConfig } from './config';
import { NodeFileSystem } from './NodeFileSystem';
export * from '@shopify/theme-check-common';
export * from './config/types';
export { NodeFileSystem };
export declare const loadConfig: typeof resolveConfig;
export type ThemeCheckRun = {
    theme: Theme;
    config: Config;
    offenses: Offense[];
};
export declare function toSourceCode(absolutePath: string): Promise<LiquidSourceCode | JSONSourceCode | undefined>;
export declare function check(root: string, configPath?: string): Promise<Offense[]>;
export declare function checkAndAutofix(root: string, configPath?: string): Promise<void>;
export declare function themeCheckRun(root: string, configPath?: string, log?: (message: string) => void): Promise<ThemeCheckRun>;
export declare function getThemeAndConfig(root: string, configPath?: string): Promise<{
    theme: Theme;
    config: Config;
}>;
export declare function getTheme(config: Config): Promise<Theme>;
export declare function getThemeFilesPathPattern(rootUri: string): string;
