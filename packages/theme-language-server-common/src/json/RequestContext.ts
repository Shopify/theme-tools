import { LiquidHtmlNode, LiquidRawTag } from '@shopify/liquid-html-parser';
import { isError, JSONNode, SourceCodeType } from '@shopify/theme-check-common';
import {
  AugmentedJsonSourceCode,
  AugmentedLiquidSourceCode,
  AugmentedSourceCode,
} from '../documents';

export type RequestContext = {
  doc: AugmentedSourceCode;
  schema?: LiquidRawTag;
  parsed?: any | Error;
};

export type LiquidRequestContext = {
  doc: Omit<AugmentedLiquidSourceCode, 'ast'> & { ast: LiquidHtmlNode };
  schema: LiquidRawTag;
  parsed: any;
};

export type JSONRequestContext = {
  doc: Omit<AugmentedJsonSourceCode, 'ast'> & { ast: JSONNode };
};

export function isLiquidRequestContext(context: RequestContext): context is LiquidRequestContext {
  const { doc, schema, parsed } = context;
  return (
    doc.type === SourceCodeType.LiquidHtml && !!schema && !isError(doc.ast) && !isError(parsed)
  );
}

export function isJSONRequestContext(context: RequestContext): context is JSONRequestContext {
  const { doc } = context;
  return doc.type === SourceCodeType.JSON && !isError(doc.ast);
}
