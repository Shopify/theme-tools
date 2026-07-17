import { TokenType } from './tokenizer';
import { ParserBase } from './base';
import { makeTextNode, makeYamlFrontmatter } from './factories';
import type {
  LiquidHtmlNode,
  LiquidVariableOutput,
  LiquidRawTag,
  LiquidTag,
  TextNode,
  HtmlElement,
  HtmlVoidElement,
  HtmlSelfClosingElement,
  HtmlRawNode,
  HtmlComment,
  HtmlDoctype,
  HtmlDanglingMarkerClose,
  YAMLFrontmatter,
} from '../ast';
import { LiquidHTMLASTParsingError } from '../errors';
import { assertNever } from '../utils';

export interface NodeDispatchDelegate extends ParserBase {
  readonly dispatchParseHtml: boolean;
  readonly dispatchAllowUnclosedHtml: boolean;

  parseLiquidVariableOutput(): LiquidVariableOutput;
  parseLiquidTag(): LiquidTag | LiquidRawTag;
  parseHtmlElement(): HtmlElement | HtmlVoidElement | HtmlSelfClosingElement | HtmlRawNode;
  parseHtmlComment(): HtmlComment;
  parseHtmlDoctype(): HtmlDoctype;
  parseOrphanedHtmlCloseTag(): never;
  parseHtmlDanglingMarkerClose(): HtmlDanglingMarkerClose;
}

// node := text | yamlFrontmatter | liquidVariableOutput | liquidTag | htmlElement | htmlComment | htmlDoctype
export function parseNode(p: NodeDispatchDelegate): LiquidHtmlNode {
  const token = p.peek();

  switch (token.type) {
    case TokenType.Text: {
      p.advance();
      return makeTextNode(
        p.getSource().slice(token.start, token.end),
        token.start,
        token.end,
        p.getSource(),
      );
    }

    case TokenType.YamlFrontmatter:
      return parseYamlFrontmatter(p);

    case TokenType.EndOfInput:
      throw new LiquidHTMLASTParsingError(
        'Unexpected end of input in parseNode',
        p.getSource(),
        token.start,
        token.end,
      );

    case TokenType.LiquidVariableOutputOpen:
      return p.parseLiquidVariableOutput();

    case TokenType.LiquidTagOpen:
      return p.parseLiquidTag();

    case TokenType.LiquidTagClose:
    case TokenType.LiquidVariableOutputClose:
      return advanceAsText(p);

    case TokenType.HtmlTagOpen:
      if (p.dispatchParseHtml) return p.parseHtmlElement();
      return advanceAsText(p);

    case TokenType.HtmlCloseTagOpen:
      if (p.dispatchParseHtml && p.dispatchAllowUnclosedHtml)
        return p.parseHtmlDanglingMarkerClose();
      if (p.dispatchParseHtml) return p.parseOrphanedHtmlCloseTag();
      return advanceAsText(p);

    case TokenType.HtmlCommentOpen:
      if (p.dispatchParseHtml) return p.parseHtmlComment();
      return advanceAsText(p);

    case TokenType.HtmlDoctypeOpen:
      if (p.dispatchParseHtml) return p.parseHtmlDoctype();
      return advanceAsText(p);

    case TokenType.HtmlTagClose:
    case TokenType.HtmlSelfClose:
    case TokenType.HtmlCommentClose:
    case TokenType.HtmlEquals:
    case TokenType.HtmlQuoteOpen:
    case TokenType.HtmlQuoteClose:
      return advanceAsText(p);

    default:
      return assertNever(token.type);
  }
}

// yamlFrontmatter := "---" text "---"
export function parseYamlFrontmatter(p: ParserBase): YAMLFrontmatter {
  const token = p.advance();
  const source = p.getSource();
  const raw = source.slice(token.start, token.end);
  const firstNewline = raw.indexOf('\n');
  const lastDashes = raw.lastIndexOf('---');
  const body =
    firstNewline !== -1 && lastDashes > firstNewline ? raw.slice(firstNewline + 1, lastDashes) : '';

  return makeYamlFrontmatter(body, token.start, token.end, source);
}

export function advanceAsText(p: ParserBase): TextNode {
  const token = p.advance();
  const source = p.getSource();
  return makeTextNode(source.slice(token.start, token.end), token.start, token.end, source);
}
