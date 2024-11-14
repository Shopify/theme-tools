import { LiquidRawTag } from '@shopify/liquid-html-parser';
import { parseJSON } from './json';
import * as path from './path';
import { toJSONAST } from './to-source-code';
import {
  BlockSchema,
  LiquidHtmlNode,
  SectionSchema,
  SourceCode,
  SourceCodeType,
  ThemeSchema,
  ThemeSchemaType,
  UriString,
} from './types';
import { visit } from './visitor';

export function toSchema(
  uri: UriString,
  sourceCode: SourceCode,
): SectionSchema | BlockSchema | undefined {
  if (sourceCode.type !== SourceCodeType.LiquidHtml) return undefined;
  switch (true) {
    case isBlock(uri):
      return toBlockSchema(uri, sourceCode.ast);
    case isSection(uri):
      return toSectionSchema(uri, sourceCode.ast);
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

export function isBlockSchema(
  schema: SectionSchema | BlockSchema | undefined,
): schema is BlockSchema {
  return schema?.type === ThemeSchemaType.Block;
}

export function isSectionSchema(
  schema: SectionSchema | BlockSchema | undefined,
): schema is SectionSchema {
  return schema?.type === ThemeSchemaType.Section;
}

export function toBlockSchema(uri: UriString, liquidAst: LiquidHtmlNode | Error): BlockSchema {
  const name = path.basename(uri, '.liquid');
  const schemaNode = toSchemaNode(liquidAst);
  return {
    type: ThemeSchemaType.Block,
    name,
    parsed: toParsed(schemaNode),
    ast: toAst(schemaNode),
  };
}

// Coincidentally very similar right now... but could be different in the future
// given there might be a plan to support folders in the blocks folder.
// e.g. if we start having a stricter "parsed" object / ways to get settings.
export function toSectionSchema(uri: UriString, liquidAst: LiquidHtmlNode | Error): SectionSchema {
  const name = path.basename(uri, '.liquid');
  const schemaNode = toSchemaNode(liquidAst);
  return {
    type: ThemeSchemaType.Section,
    name,
    parsed: toParsed(schemaNode),
    ast: toAst(schemaNode),
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

function toParsed(schemaNode: LiquidRawTag | Error): any | Error {
  if (schemaNode instanceof Error) return schemaNode;
  return parseJSON(schemaNode.body.value);
}

function toAst(schemaNode: LiquidRawTag | Error): SourceCode<SourceCodeType.JSON>['ast'] | Error {
  if (schemaNode instanceof Error) return schemaNode;
  return toJSONAST(schemaNode.body.value);
}
