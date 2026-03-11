import { Logger } from './utils';
export declare const root: string;
export declare const ThemeLiquidDocsRoot = "https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main";
export declare const ThemeLiquidDocsSchemaRoot = "https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/schemas";
export type Resource = (typeof Resources)[number];
export declare const Resources: readonly ["filters", "objects", "tags", "shopify_system_translations", "manifest_theme", "manifest_theme_app_extension"];
export declare const Manifests: {
    readonly app: "manifest_theme_app_extension";
    readonly theme: "manifest_theme";
};
export declare function downloadSchema(relativeUri: string, destination?: string, log?: Logger): Promise<string>;
export declare function downloadResource(resource: Resource | 'latest', destination?: string, log?: Logger): Promise<string>;
export declare function download(path: string, log: Logger): Promise<string>;
export declare function resourcePath(resource: Resource | 'latest', destination?: string): string;
export declare function resourceUrl(resource: Resource | 'latest'): string;
export declare function schemaPath(relativeUri: string, destination?: string): string;
export declare function schemaUrl(relativeUri: string): string;
export declare function exists(path: string): Promise<boolean>;
export declare function downloadThemeLiquidDocs(destination: string, log: Logger): Promise<void>;
