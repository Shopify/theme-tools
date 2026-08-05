import type {
  AttributeNode,
  DocumentNode,
  HtmlComment,
  HtmlDanglingMarkerClose,
  HtmlDoctype,
  HtmlElement,
  HtmlRawNode,
  HtmlSelfClosingElement,
  HtmlVoidElement,
  LiquidHtmlNode,
  LiquidNode,
  LiquidRawTag,
  LiquidStatement,
  LiquidTag,
  LiquidVariableOutput,
  TextNode,
} from '../ast';
import '../environment'; // side-effect: ensures builtinTags init before downstream imports
import type { Environment, LiquidLineContext } from '../environment';
import type { Position } from '../types';
import { ParserBase } from './base';
import type { LiquidCloseWhitespace, LiquidOpenWhitespace } from './factories';
import { makeDocumentNode } from './factories';
import type { HtmlParserDelegate } from './html';
import {
  parseBranchAttributesImpl as parseBranchAttributesFn,
  parseHtmlComment as parseHtmlCommentFn,
  parseHtmlDanglingMarkerClose as parseHtmlDanglingMarkerCloseFn,
  parseHtmlDoctype as parseHtmlDoctypeFn,
  parseHtmlElement as parseHtmlElementFn,
  parseOrphanedHtmlCloseTag as parseOrphanedHtmlCloseTagFn,
} from './html';
import type { BlockParserDelegate } from './liquid-blocks';
import {
  consumeEndTag as consumeEndTagFn,
  isBlockTerminator as isBlockTerminatorFn,
  peekTagName as peekTagNameFn,
} from './liquid-blocks';
import type { LineParserDelegate } from './liquid-lines';
import { parseLiquidStatement as parseLiquidStatementFn } from './liquid-lines';
import type { RawParserDelegate } from './liquid-raw';
import { parseLiquidInRange as parseLiquidInRangeFn } from './liquid-raw';
import type { TagParserDelegate } from './liquid-tags';
import { parseLiquidTag as parseLiquidTagFn } from './liquid-tags';
import { parseLiquidVariableOutput as parseLiquidVariableOutputFn } from './liquid-variable-output';
import type { NodeDispatchDelegate } from './node-dispatch';
import { parseNode as parseNodeFn } from './node-dispatch';
import type { Token } from './tokenizer';
import { TokenType } from './tokenizer';
import { ChildFilterMode, filterChildren } from './tree-builder';

export class DocumentParser
  extends ParserBase
  implements
    TagParserDelegate,
    BlockParserDelegate,
    RawParserDelegate,
    HtmlParserDelegate,
    LineParserDelegate,
    NodeDispatchDelegate
{
  private env: Environment;
  private _parseHtml: boolean;
  private _allowUnclosedHtml: boolean;
  private readonly _allowUnclosedDocumentNode: boolean;
  private _inAttributeContext: boolean = false;
  private _inAttributeValueContext: boolean = false;

  constructor(
    tokens: Token[],
    source: string,
    env: Environment,
    parseHtml: boolean,
    allowUnclosedDocumentNode: boolean = false,
  ) {
    super(tokens, source);
    this.env = env;
    this._parseHtml = parseHtml;
    this._allowUnclosedHtml = allowUnclosedDocumentNode;
    this._allowUnclosedDocumentNode = allowUnclosedDocumentNode;
  }

  get rawParseHtml(): boolean {
    return this._parseHtml;
  }
  set rawParseHtml(v: boolean) {
    this._parseHtml = v;
  }
  get blockEnv(): Environment {
    return this.env;
  }
  get blockParseHtml(): boolean {
    return this._parseHtml;
  }
  get blockAllowUnclosedHtml(): boolean {
    return this._allowUnclosedHtml;
  }
  set blockAllowUnclosedHtml(v: boolean) {
    this._allowUnclosedHtml = v;
  }
  get blockAllowUnclosedDocumentNode(): boolean {
    return this._allowUnclosedDocumentNode;
  }
  get blockInAttributeContext(): boolean {
    return this._inAttributeContext;
  }
  get blockInAttributeValueContext(): boolean {
    return this._inAttributeValueContext;
  }
  set blockInAttributeValueContext(v: boolean) {
    this._inAttributeValueContext = v;
  }
  get htmlParseHtml(): boolean {
    return this._parseHtml;
  }
  get htmlAllowUnclosedHtml(): boolean {
    return this._allowUnclosedHtml;
  }
  set htmlAllowUnclosedHtml(v: boolean) {
    this._allowUnclosedHtml = v;
  }
  get htmlInAttributeContext(): boolean {
    return this._inAttributeContext;
  }
  set htmlInAttributeContext(v: boolean) {
    this._inAttributeContext = v;
  }
  get htmlInAttributeValueContext(): boolean {
    return this._inAttributeValueContext;
  }
  set htmlInAttributeValueContext(v: boolean) {
    this._inAttributeValueContext = v;
  }
  get lineEnv(): Environment {
    return this.env;
  }
  get lineParseHtml(): boolean {
    return this._parseHtml;
  }
  get lineAllowUnclosedDocumentNode(): boolean {
    return this._allowUnclosedDocumentNode;
  }
  get dispatchParseHtml(): boolean {
    return this._parseHtml;
  }
  get dispatchAllowUnclosedHtml(): boolean {
    return this._allowUnclosedHtml;
  }

  tagForName(name: string) {
    return this.env.tagForName(name);
  }

  // document := yamlFrontmatter? node*
  parseDocument(): DocumentNode {
    const children: LiquidHtmlNode[] = [];
    if (this.check(TokenType.YamlFrontmatter)) children.push(parseNodeFn(this));
    while (!this.isAtEnd()) children.push(this.parseNode());
    return makeDocumentNode(
      filterChildren(ChildFilterMode.Syntactic, children, this.source),
      this.source,
    );
  }

  parseNode(): LiquidHtmlNode {
    return parseNodeFn(this);
  }
  parseLiquidTag(): LiquidTag | LiquidRawTag {
    return parseLiquidTagFn(this);
  }
  parseLiquidVariableOutput(): LiquidVariableOutput {
    return parseLiquidVariableOutputFn(this);
  }
  peekTagName(): string | null {
    return peekTagNameFn(this);
  }
  isBlockTerminator(): boolean {
    return isBlockTerminatorFn(this);
  }
  consumeEndTag(): {
    position: Position;
    whitespace: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace };
  } {
    return consumeEndTagFn(this);
  }
  parseLiquidInRange(bodyStart: number, bodyEnd: number): (LiquidNode | TextNode)[] {
    return parseLiquidInRangeFn(this, bodyStart, bodyEnd);
  }
  parseBranchAttributes(): AttributeNode[] {
    return parseBranchAttributesFn(this);
  }
  parseLiquidStatement(
    tagName: string,
    markupString: string,
    markupOffset: number,
    ctx: LiquidLineContext,
  ): LiquidStatement {
    return parseLiquidStatementFn(this, tagName, markupString, markupOffset, ctx);
  }
  parseHtmlElement(): HtmlElement | HtmlVoidElement | HtmlSelfClosingElement | HtmlRawNode {
    return parseHtmlElementFn(this);
  }
  parseHtmlComment(): HtmlComment {
    return parseHtmlCommentFn(this);
  }
  parseHtmlDoctype(): HtmlDoctype {
    return parseHtmlDoctypeFn(this);
  }
  parseOrphanedHtmlCloseTag(): never {
    return parseOrphanedHtmlCloseTagFn(this);
  }
  parseHtmlDanglingMarkerClose(): HtmlDanglingMarkerClose {
    return parseHtmlDanglingMarkerCloseFn(this);
  }
}

export { finalizeBranch } from './liquid-blocks';
