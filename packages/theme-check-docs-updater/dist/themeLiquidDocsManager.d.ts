import { FilterEntry, JsonValidationSet, ObjectEntry, SchemaDefinition, TagEntry, ThemeDocset, Translations } from '@shopify/theme-check-common';
import { Logger } from './utils';
export declare class ThemeLiquidDocsManager implements ThemeDocset, JsonValidationSet {
    private log;
    constructor(log?: Logger);
    filters: import("@shopify/theme-check-common").MemoedFunction<() => Promise<FilterEntry[]>>;
    objects: import("@shopify/theme-check-common").MemoedFunction<() => Promise<ObjectEntry[]>>;
    liquidDrops: import("@shopify/theme-check-common").MemoedFunction<() => Promise<ObjectEntry[]>>;
    tags: import("@shopify/theme-check-common").MemoedFunction<() => Promise<TagEntry[]>>;
    systemTranslations: import("@shopify/theme-check-common").MemoedFunction<() => Promise<Translations>>;
    schemas: {
        (x: "theme" | "app"): Promise<SchemaDefinition[]>;
        force(x: "theme" | "app"): Promise<SchemaDefinition[]>;
        invalidate(x: "theme" | "app"): void;
        clearCache(): void;
    };
    /**
     * The setup method checks that the latest revision matches the one from
     * Shopify/theme-liquid-docs. If there's a diff in revision, it means
     * that the documentations that you have locally are out of date.
     *
     * The setup method then downloads the other files.
     */
    setup: import("@shopify/theme-check-common").MemoedFunction<() => Promise<void>>;
    private latestRevision;
    private loadResource;
    private load;
    private loadSchema;
    private loaders;
    private schemaLoaders;
}
