import { AbstractFileSystem, SectionSchema, ThemeBlockSchema } from '@shopify/theme-check-common';
export declare function makeGetSourceCode(fs: AbstractFileSystem): {
    (x: string): Promise<import("..").FileSourceCode>;
    force(x: string): Promise<import("..").FileSourceCode>;
    invalidate(x: string): void;
    clearCache(): void;
};
export declare const fixturesRoot: string;
export declare const skeleton: string;
export declare function getDependencies(rootUri: string, fs?: AbstractFileSystem): Promise<{
    fs: AbstractFileSystem;
    getSectionSchema: {
        (x: string): Promise<SectionSchema>;
        force(x: string): Promise<SectionSchema>;
        invalidate(x: string): void;
        clearCache(): void;
    };
    getBlockSchema: {
        (x: string): Promise<ThemeBlockSchema>;
        force(x: string): Promise<ThemeBlockSchema>;
        invalidate(x: string): void;
        clearCache(): void;
    };
    getSourceCode: {
        (x: string): Promise<import("..").FileSourceCode>;
        force(x: string): Promise<import("..").FileSourceCode>;
        invalidate(x: string): void;
        clearCache(): void;
    };
    getWebComponentDefinitionReference: (customElementName: string) => import("..").WebComponentDefinition | undefined;
}>;
export declare function mockImpl(obj: any, method: any, callback: any): import("vitest").MockInstance<(this: unknown, ...args: unknown[]) => unknown>;
