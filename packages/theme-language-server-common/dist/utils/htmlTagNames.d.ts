import { LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { TextDocumentPositionParams, Range } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
export declare function getHtmlElementNameRanges(node: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: TextDocumentPositionParams, textDocument: TextDocument): Range[] | null;
export declare function isDanglingOpenHtmlElement(node: LiquidHtmlNode): boolean;
