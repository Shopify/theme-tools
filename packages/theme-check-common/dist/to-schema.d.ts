import { AppBlockSchema, ThemeBlockSchema, IsValidSchema, LiquidHtmlNode, SectionSchema, SourceCode, SourceCodeType, UriString, Context, Schema } from './types';
export declare function toSchema(mode: 'app' | 'theme', uri: UriString, sourceCode: SourceCode, isValidSchema: IsValidSchema | undefined, isStrict?: boolean): Promise<AppBlockSchema | SectionSchema | ThemeBlockSchema | undefined>;
export declare function isBlock(uri: UriString): boolean;
export declare function isSection(uri: UriString): boolean;
export declare function isSnippet(uri: UriString): boolean;
export declare function isBlockSchema(schema: AppBlockSchema | SectionSchema | ThemeBlockSchema | undefined): schema is ThemeBlockSchema;
export declare function isSectionSchema(schema: AppBlockSchema | SectionSchema | ThemeBlockSchema | undefined): schema is SectionSchema;
export declare function toBlockSchema(uri: UriString, liquidAst: LiquidHtmlNode | Error, isValidSchema: IsValidSchema | undefined, isStrict: boolean): Promise<ThemeBlockSchema>;
export declare function toSectionSchema(uri: UriString, liquidAst: LiquidHtmlNode | Error, isValidSchema: IsValidSchema | undefined, isStrict: boolean): Promise<SectionSchema>;
export declare function toAppBlockSchema(uri: UriString, liquidAst: LiquidHtmlNode | Error, isStrict: boolean): Promise<AppBlockSchema>;
export declare function getSchema(context: Context<SourceCodeType.LiquidHtml, Schema>): Promise<ThemeBlockSchema | undefined> | Promise<SectionSchema | undefined> | undefined;
export declare function getSchemaFromJSON(context: Context<SourceCodeType.JSON, Schema>): Promise<{
    parsed: any;
    ast: Error | import("./types").JSONNode;
}>;
