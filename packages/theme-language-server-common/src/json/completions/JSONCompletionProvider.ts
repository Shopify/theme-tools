import { LiquidHtmlNode, LiquidRawTag } from '@shopify/liquid-html-parser';
import { JSONNode } from '@shopify/theme-check-common';
import { CompletionItem, JSONPath } from 'vscode-json-languageservice';
import {
  AugmentedJsonSourceCode,
  AugmentedLiquidSourceCode,
  AugmentedSourceCode,
} from '../../documents';
import { RequestContext } from '../RequestContext';

export type HoverContext = {
  doc: AugmentedSourceCode;
  schema?: LiquidRawTag;
  parsed?: any | Error;
};

export type LiquidHoverContext = {
  doc: Omit<AugmentedLiquidSourceCode, 'ast'> & { ast: LiquidHtmlNode };
  schema: LiquidRawTag;
  parsed: any;
};

export type JSONHoverContext = {
  doc: Omit<AugmentedJsonSourceCode, 'ast'> & { ast: JSONNode };
};

/** For some reason, json-languageservice requires it. */
export type JSONCompletionItem = CompletionItem & { insertText: string };

export interface JSONCompletionProvider {
  completeProperty?(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]>;
  completeValue?(context: RequestContext, path: JSONPath): Promise<JSONCompletionItem[]>;
}
