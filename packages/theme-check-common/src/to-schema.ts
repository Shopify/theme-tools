import { ContentForMarkup, LiquidRawTag, NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import { parseJSON } from './json';
import * as path from './path';
import { toJSONAST } from './to-source-code';
import {
  AppBlockSchema,
  ThemeBlockSchema,
  IsValidSchema,
  LiquidHtmlNode,
  SectionSchema,
  SourceCode,
  SourceCodeType,
  ThemeBlock,
  ThemeSchemaType,
  UriString,
  Context,
  Schema,
  StaticBlockDef,
} from './types';
import { visit } from './visitor';

export async function toSchema(
  mode: 'app' | 'theme',
  uri: UriString,
  sourceCode: SourceCode,
  isValidSchema: IsValidSchema | undefined,
  isStrict: boolean = true,
): Promise<AppBlockSchema | SectionSchema | ThemeBlockSchema | undefined> {
  if (sourceCode.type !== SourceCodeType.LiquidHtml) return undefined;
  switch (true) {
    case mode === 'app' && isBlock(uri):
      return toAppBlockSchema(uri, sourceCode.ast, isStrict);
    case mode === 'theme' && isBlock(uri):
      return toBlockSchema(uri, sourceCode.ast, isValidSchema, isStrict);
    case mode === 'theme' && isSection(uri):
      return toSectionSchema(uri, sourceCode.ast, isValidSchema, isStrict);
    default:
      return undefined;
  }
}

export function isBlock(uri: UriString) {
  return path.dirname(uri).endsWith('blocks');
}

export function isSection(uri: UriString) {
  return path.dirname(uri).endsWith('sections');
}

export function isSnippet(uri: UriString) {
  return path.dirname(uri).endsWith('snippets');
}

export function isBlockSchema(
  schema: AppBlockSchema | SectionSchema | ThemeBlockSchema | undefined,
): schema is ThemeBlockSchema {
  return schema?.type === ThemeSchemaType.Block;
}

export function isSectionSchema(
  schema: AppBlockSchema | SectionSchema | ThemeBlockSchema | undefined,
): schema is SectionSchema {
  return schema?.type === ThemeSchemaType.Section;
}

async function toValidSchema<T>(
  uri: string,
  schemaNode: LiquidRawTag | Error,
  parsed: any | Error,
  isValidSchema: IsValidSchema | undefined,
): Promise<T | Error> {
  if (!isValidSchema) return new Error('No JSON validator provided');
  if (schemaNode instanceof Error) return parsed;
  if (await isValidSchema(uri, schemaNode.body.value)) {
    return parsed as T;
  } else {
    return new Error('Invalid schema');
  }
}

export async function toBlockSchema(
  uri: UriString,
  liquidAst: LiquidHtmlNode | Error,
  isValidSchema: IsValidSchema | undefined,
  isStrict: boolean,
): Promise<ThemeBlockSchema> {
  const name = path.basename(uri, '.liquid');
  const schemaNode = toSchemaNode(liquidAst);
  const staticBlockDefs = toStaticBlockDefs(liquidAst);
  const parsed = toParsed(schemaNode, isStrict);
  const ast = toAst(schemaNode);

  return {
    type: ThemeSchemaType.Block,
    validSchema: await toValidSchema<ThemeBlock.Schema>(uri, schemaNode, parsed, isValidSchema),
    offset: schemaNode instanceof Error ? 0 : schemaNode.blockStartPosition.end,
    name,
    parsed,
    ast,
    value: schemaNode instanceof Error ? '' : schemaNode.body.value,
    staticBlockDefs,
  };
}

// Coincidentally very similar right now... but could be different in the future
// given there might be a plan to support folders in the blocks folder.
// e.g. if we start having a stricter "parsed" object / ways to get settings.
export async function toSectionSchema(
  uri: UriString,
  liquidAst: LiquidHtmlNode | Error,
  isValidSchema: IsValidSchema | undefined,
  isStrict: boolean,
): Promise<SectionSchema> {
  const name = path.basename(uri, '.liquid');
  const schemaNode = toSchemaNode(liquidAst);
  const staticBlockDefs = toStaticBlockDefs(liquidAst);
  const parsed = toParsed(schemaNode, isStrict);
  const ast = toAst(schemaNode);

  return {
    type: ThemeSchemaType.Section,
    validSchema: await toValidSchema(uri, schemaNode, parsed, isValidSchema),
    offset: schemaNode instanceof Error ? 0 : schemaNode.blockStartPosition.end,
    name,
    parsed,
    ast,
    value: schemaNode instanceof Error ? '' : schemaNode.body.value,
    staticBlockDefs,
  };
}

// validSchema not implemented yet. You can still `visit` the ast.
export async function toAppBlockSchema(
  uri: UriString,
  liquidAst: LiquidHtmlNode | Error,
  isStrict: boolean,
): Promise<AppBlockSchema> {
  const name = path.basename(uri, '.liquid');
  const schemaNode = toSchemaNode(liquidAst);
  const parsed = toParsed(schemaNode, isStrict);
  const ast = toAst(schemaNode);

  return {
    type: ThemeSchemaType.AppBlock,
    offset: schemaNode instanceof Error ? 0 : schemaNode.blockStartPosition.end,
    name,
    parsed,
    ast,
    value: schemaNode instanceof Error ? '' : schemaNode.body.value,
  };
}

function toSchemaNode(ast: LiquidHtmlNode | Error): LiquidRawTag | Error {
  if (ast instanceof Error) return ast;
  return (
    visit<SourceCodeType.LiquidHtml, LiquidRawTag>(ast, {
      LiquidRawTag(node) {
        if (node.name === 'schema') {
          return node;
        }
      },
    })[0] ?? new Error('No schema tag found')
  );
}

function toStaticBlockDefs(ast: LiquidHtmlNode | Error): StaticBlockDef[] {
  if (ast instanceof Error) return [];
  return visit<SourceCodeType.LiquidHtml, StaticBlockDef>(ast, {
    LiquidTag(node) {
      if (node.name !== NamedTags.content_for) return;
      if (typeof node.markup === 'string') return;
      const contentForMarkup: ContentForMarkup = node.markup;
      if (contentForMarkup.contentForType.value !== 'block') return;
      const type = contentForMarkup.args.find((x) => x.name === 'type');
      const id = contentForMarkup.args.find((x) => x.name === 'id');
      if (!type || !id) return;
      if (type.value.type !== NodeTypes.String) return;
      if (id.value.type !== NodeTypes.String) return;

      return {
        type: type.value.value,
        id: id.value.value,
      };
    },
  });
}

export function getSchema(context: Context<SourceCodeType.LiquidHtml, Schema>) {
  const name = path.basename(context.file.uri, '.liquid');
  switch (true) {
    case isBlock(context.file.uri):
      return context.getBlockSchema?.(name);
    case isSection(context.file.uri):
      return context.getSectionSchema?.(name);
    default:
      return undefined;
  }
}

export async function getSchemaFromJSON(context: Context<SourceCodeType.JSON, Schema>) {
  const originalSource = context.file.source;

  const parsed = parseJSON(originalSource);
  const ast = toJSONAST(originalSource);

  return {
    parsed,
    ast,
  };
}

function toParsed(schemaNode: LiquidRawTag | Error, isStrict: boolean): any | Error {
  if (schemaNode instanceof Error) return schemaNode;
  return parseJSON(schemaNode.body.value, undefined, isStrict);
}

function toAst(schemaNode: LiquidRawTag | Error): SourceCode<SourceCodeType.JSON>['ast'] | Error {
  if (schemaNode instanceof Error) return schemaNode;
  return toJSONAST(schemaNode.body.value);
}
