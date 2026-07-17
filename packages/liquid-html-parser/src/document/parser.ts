import { TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import { ParserBase } from './base';
import { makeDocumentNode } from './factories';
import { ChildFilterMode, filterChildren } from './tree-builder';
import type {
  DocumentNode,
  LiquidHtmlNode,
  LiquidStatement,
  LiquidVariableOutput,
  LiquidRawTag,
  LiquidTag,
  LiquidNode,
  TextNode,
  HtmlElement,
  HtmlVoidElement,
  HtmlSelfClosingElement,
  HtmlRawNode,
  HtmlComment,
  HtmlDoctype,
  HtmlDanglingMarkerClose,
  AttributeNode,
} from '../ast';
import '../environment'; // side-effect: ensures builtinTags init before downstream imports
import type { Environment, LiquidLineContext } from '../environment';
import type { Position } from '../types';
import type { LiquidOpenWhitespace, LiquidCloseWhitespace } from './factories';
import { parseLiquidVariableOutput as parseLiquidVariableOutputFn } from './liquid-variable-output';
import {
  peekTagName as peekTagNameFn,
  isBlockTerminator as isBlockTerminatorFn,
  consumeEndTag as consumeEndTagFn,
} from './liquid-blocks';
import type { BlockParserDelegate } from './liquid-blocks';
import { parseLiquidInRange as parseLiquidInRangeFn } from './liquid-raw';
import type { RawParserDelegate } from './liquid-raw';
import { parseLiquidTag as parseLiquidTagFn } from './liquid-tags';
import type { TagParserDelegate } from './liquid-tags';
import {
  parseHtmlElement as parseHtmlElementFn,
  parseHtmlComment as parseHtmlCommentFn,
  parseHtmlDoctype as parseHtmlDoctypeFn,
  parseOrphanedHtmlCloseTag as parseOrphanedHtmlCloseTagFn,
  parseHtmlDanglingMarkerClose as parseHtmlDanglingMarkerCloseFn,
  parseBranchAttributesImpl as parseBranchAttributesFn,
} from './html';
import type { HtmlParserDelegate } from './html';
import { parseLiquidStatement as parseLiquidStatementFn } from './liquid-lines';
import type { LineParserDelegate } from './liquid-lines';
import { parseNode as parseNodeFn } from './node-dispatch';
import type { NodeDispatchDelegate } from './node-dispatch';

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
