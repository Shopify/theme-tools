import { TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import { ParserBase } from './base';
import {
  makeLiquidTagBaseCase,
  makeLiquidTagNamed,
  makeLiquidBranchUnnamed,
  makeLiquidBranchNamed,
  envelopeFromTokens,
} from './factories';
import type { LiquidTagEnvelope, LiquidOpenWhitespace, LiquidCloseWhitespace } from './factories';
import { mergeAdjacentTextNodes, ChildFilterMode, filterChildren } from './tree-builder';
import type { Position } from '../types';
import type {
  LiquidHtmlNode,
  LiquidTag,
  LiquidRawTag,
  LiquidBranch,
  LiquidBranchUnnamed,
  LiquidBranchNamed,
  AttributeNode,
} from '../ast';
import type { TagDefinitionBlock, BranchName, Parser } from '../environment';
import { LiquidHTMLASTParsingError } from '../errors';
import { assertNever } from '../utils';
import { MarkupParser } from '../markup/parser';
import { tokenizeMarkup } from '../markup/tokenizer';
import { elsifBranchParse } from '../tags/if';
import { whenBranchParse } from '../tags/case';

/**
 * Interface capturing what block-parsing free functions need from the
 * DocumentParser.  The parser class satisfies this contract, keeping
 * the coupling explicit and narrow.
 */
export interface BlockParserDelegate extends ParserBase, Parser {
  readonly blockEnv: {
    tagForName(name: string): { kind: string } | undefined;
  };
  readonly blockParseHtml: boolean;
  blockAllowUnclosedHtml: boolean;
  readonly blockAllowUnclosedDocumentNode: boolean;
  readonly blockInAttributeContext: boolean;
  readonly blockInAttributeValueContext: boolean;

  parseNode(): LiquidHtmlNode;
  peekTagName(): string | null;
  consumeEndTag(): {
    position: Position;
    whitespace: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace };
  };
  isBlockTerminator(): boolean;
  parseBranchAttributes(): AttributeNode[];
  parseLiquidTag(): LiquidTag | LiquidRawTag;
}

// blockTag := "{%" tagName markup "%}" branchedBody | blockBody "{%" "end" tagName "%}"
export function parseBlockTag(
  parser: BlockParserDelegate,
  def: TagDefinitionBlock,
  envelope: LiquidTagEnvelope,
  closeToken: Token,
): LiquidTag {
  let markup: unknown;
  let markupParsed = false;
  let reason: string | undefined;
  try {
    const markupStringStart = closeToken.start - envelope.markupString.length;
    const tokens = tokenizeMarkup(envelope.markupString, markupStringStart);
    const markupParser = new MarkupParser(tokens, parser.getSource());
    if (parser.isTolerant()) markupParser.enableTolerant();
    markup = def.parse(envelope.tagName, markupParser, parser);
    if (!markupParser.isAtEnd()) {
      markup = undefined;
      reason = 'unexpected tokens after markup';
    } else {
      markupParsed = true;
    }
  } catch (e) {
    markup = undefined;
    reason = e instanceof Error ? e.message : 'unknown error';
  }

  const savedAllowUnclosed = parser.blockAllowUnclosedHtml;
  parser.blockAllowUnclosedHtml = CONDITIONAL_TAGS.has(envelope.tagName);

  try {
    if (def.branches.length === 0) {
      const { children, endPosition, endWhitespace } = parseBlockBody(parser, envelope);
      if (markupParsed) {
        return makeLiquidTagNamed(envelope, markup, children, endPosition, endWhitespace);
      }
      return makeLiquidTagBaseCase(envelope, children, endPosition, endWhitespace, reason);
    }

    const { branches, endPosition, endWhitespace } = parseBranchedBody(parser, envelope, def);
    if (markupParsed) {
      return makeLiquidTagNamed(envelope, markup, branches, endPosition, endWhitespace);
    }
    return makeLiquidTagBaseCase(envelope, branches, endPosition, endWhitespace, reason);
  } finally {
    parser.blockAllowUnclosedHtml = savedAllowUnclosed;
  }
}

// blockBody := node* "{%" "end" tagName "%}"
export function parseBlockBody(
  parser: BlockParserDelegate,
  envelope: LiquidTagEnvelope,
): {
  children: LiquidHtmlNode[];
  endPosition: Position;
  endWhitespace: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace };
} {
  const parentName = envelope.tagName;
  const children: LiquidHtmlNode[] = [];

  while (!parser.isAtEnd()) {
    if (parser.check(TokenType.LiquidTagOpen)) {
      const tagName = parser.peekTagName();
      if (tagName === `end${parentName}`) {
        const end = parser.consumeEndTag();
        const merged = filterChildren(ChildFilterMode.Syntactic, children, parser.getSource());
        return { children: merged, endPosition: end.position, endWhitespace: end.whitespace };
      }

      if (tagName && tagName.startsWith('end')) {
        const innerName = tagName.slice(3);
        if (parser.blockEnv.tagForName(innerName)) {
          throw new LiquidHTMLASTParsingError(
            `Attempting to close LiquidTag '${innerName}' before LiquidTag '${parentName}' was closed`,
            parser.getSource(),
            envelope.blockStartPosition.start,
            envelope.blockStartPosition.end,
          );
        }
      }

      if (tagName && (tagName === 'else' || tagName === 'elsif' || tagName === 'when')) {
        throw new LiquidHTMLASTParsingError(
          `Attempting to open LiquidBranch '${tagName}' before LiquidTag '${parentName}' was closed`,
          parser.getSource(),
          envelope.blockStartPosition.start,
          envelope.blockStartPosition.end,
        );
      }
    }
    const progressStart = parser.getPosition();
    if (parser.blockInAttributeContext && !parser.blockInAttributeValueContext) {
      children.push(...(parser.parseBranchAttributes() as unknown as LiquidHtmlNode[]));
    } else {
      children.push(parser.parseNode());
    }
    if (parser.getPosition() === progressStart) {
      if (!parser.blockAllowUnclosedDocumentNode) {
        throwUnexpectedBlockTag(parser, parentName);
      }
      // Tolerant mode: the current token stalled the loop — an orphan tag the block can
      // neither absorb nor close (e.g. `{% endwhen %}` naming a branch keyword). Consume it
      // as a degraded node so the cursor advances and the loop can still reach the real
      // terminator (e.g. `{% endcapture %}`), instead of leaking the orphan up to the outer
      // parseAttributeList where a sibling close tag would hit the unguarded throw in
      // parseLiquidTag.
      if (parser.check(TokenType.LiquidTagOpen)) {
        children.push(parser.parseLiquidTag() as unknown as LiquidHtmlNode);
        continue;
      }
      break;
    }
  }

  {
    const merged = filterChildren(ChildFilterMode.Syntactic, children, parser.getSource());
    const endPos = parser.peek().start;
    const blockEndPosition: Position = { start: endPos, end: endPos };
    if (parser.blockAllowUnclosedDocumentNode) {
      return {
        children: merged,
        endPosition: blockEndPosition,
        endWhitespace: { start: '' as LiquidOpenWhitespace, end: '' as LiquidCloseWhitespace },
      };
    }

    throw new LiquidHTMLASTParsingError(
      `Attempting to end parsing before LiquidTag '${parentName}' was closed`,
      parser.getSource(),
      envelope.blockStartPosition.start,
      envelope.blockStartPosition.end,
    );
  }
}

// branchedBody := branch+ "{%" "end" tagName "%}"
export function parseBranchedBody(
  parser: BlockParserDelegate,
  envelope: LiquidTagEnvelope,
  def: TagDefinitionBlock,
): {
  branches: LiquidBranch[];
  endPosition: Position;
  endWhitespace: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace };
} {
  const parentName = envelope.tagName;
  const bodyStart = envelope.blockStartPosition.end;
  const branches: LiquidBranch[] = [];
  let currentBranch: LiquidBranchUnnamed | LiquidBranchNamed = makeLiquidBranchUnnamed(
    bodyStart,
    parser.getSource(),
  );
  let currentChildren: LiquidHtmlNode[] = [];
  const childFilterMode = parser.blockInAttributeValueContext
    ? ChildFilterMode.Preserve
    : ChildFilterMode.Syntactic;

  while (!parser.isAtEnd()) {
    if (parser.check(TokenType.LiquidTagOpen)) {
      const tagName = parser.peekTagName();

      if (tagName === `end${parentName}`) {
        finalizeBranch(
          currentBranch,
          currentChildren,
          parser.peek().start,
          parser.getSource(),
          childFilterMode,
        );
        branches.push(currentBranch);
        const end = parser.consumeEndTag();
        return { branches, endPosition: end.position, endWhitespace: end.whitespace };
      }

      if (isBranchName(tagName) && def.branches.includes(tagName)) {
        finalizeBranch(
          currentBranch,
          currentChildren,
          parser.peek().start,
          parser.getSource(),
          childFilterMode,
        );
        branches.push(currentBranch);

        const openToken = parser.consume(TokenType.LiquidTagOpen);
        parser.accept(TokenType.Text);
        const closeToken = parser.consume(TokenType.LiquidTagClose);
        const branchEnvelope = envelopeFromTokens(openToken, closeToken, parser.getSource());

        const branchMarkup = parseBranchMarkup(parser, tagName, branchEnvelope);
        currentBranch = makeLiquidBranchNamed(branchEnvelope, branchMarkup);
        currentChildren = [];
        continue;
      }

      if (tagName && tagName.startsWith('end')) {
        const innerName = tagName.slice(3);
        if (parser.blockEnv.tagForName(innerName)) {
          throw new LiquidHTMLASTParsingError(
            `Attempting to close LiquidTag '${innerName}' before LiquidTag '${parentName}' was closed`,
            parser.getSource(),
            envelope.blockStartPosition.start,
            envelope.blockStartPosition.end,
          );
        }
      }
    }
    const progressStart = parser.getPosition();
    if (parser.blockInAttributeContext && !parser.blockInAttributeValueContext) {
      currentChildren.push(...(parser.parseBranchAttributes() as unknown as LiquidHtmlNode[]));
    } else {
      currentChildren.push(parser.parseNode());
    }
    if (parser.getPosition() === progressStart) {
      if (!parser.blockAllowUnclosedDocumentNode) {
        throwUnexpectedBlockTag(parser, parentName);
      }
      // Tolerant mode: the current token stalled the loop — an orphan tag the block can
      // neither absorb nor close (e.g. `{% endwhen %}` naming a branch keyword). Consume it
      // as a degraded node so the cursor advances and the loop can still reach the real
      // terminator (e.g. `{% endcase %}`), instead of leaking the orphan up to the outer
      // parseAttributeList where a sibling close tag would hit the unguarded throw in
      // parseLiquidTag.
      if (parser.check(TokenType.LiquidTagOpen)) {
        currentChildren.push(parser.parseLiquidTag() as unknown as LiquidHtmlNode);
        continue;
      }
      break;
    }
  }

  {
    const endPos = parser.peek().start;
    finalizeBranch(currentBranch, currentChildren, endPos, parser.getSource(), childFilterMode);
    branches.push(currentBranch);
    const blockEndPosition: Position = { start: endPos, end: endPos };
    if (parser.blockAllowUnclosedDocumentNode) {
      return {
        branches,
        endPosition: blockEndPosition,
        endWhitespace: { start: '' as LiquidOpenWhitespace, end: '' as LiquidCloseWhitespace },
      };
    }

    throw new LiquidHTMLASTParsingError(
      `Attempting to end parsing before LiquidTag '${parentName}' was closed`,
      parser.getSource(),
      envelope.blockStartPosition.start,
      envelope.blockStartPosition.end,
    );
  }
}

export function finalizeBranch(
  branch: LiquidBranchUnnamed | LiquidBranchNamed,
  children: LiquidHtmlNode[],
  endPos: number,
  source: string,
  mode: ChildFilterMode = ChildFilterMode.StripEdges,
): void {
  const allMerged = mergeAdjacentTextNodes(children, source);
  branch.children = filterChildren(mode, children, source);
  branch.blockEndPosition = { start: endPos, end: endPos };
  branch.position.end = endPos;
  if (allMerged.length > 0) {
    const lastChildEnd = allMerged[allMerged.length - 1].position.end;
    if (lastChildEnd > endPos) {
      branch.position.end = lastChildEnd;
    }
  }
}

// branchMarkup := elsifMarkup | whenMarkup | ""
export function parseBranchMarkup(
  parser: BlockParserDelegate,
  branchName: BranchName,
  envelope: LiquidTagEnvelope,
): unknown {
  const closeTokenWidth = envelope.whitespaceEnd === '-' ? 3 : 2;
  const closeTokenStart = envelope.blockStartPosition.end - closeTokenWidth;
  const markupStringStart = closeTokenStart - envelope.markupString.length;

  switch (branchName) {
    case 'elsif': {
      try {
        const tokens = tokenizeMarkup(envelope.markupString, markupStringStart);
        const markupParser = new MarkupParser(tokens, parser.getSource());
        if (parser.isTolerant()) markupParser.enableTolerant();
        const result = elsifBranchParse(branchName, markupParser);
        if (!markupParser.isAtEnd()) return envelope.markupString.trim();
        return result;
      } catch {
        return envelope.markupString.trim();
      }
    }
    case 'when': {
      try {
        const tokens = tokenizeMarkup(envelope.markupString, markupStringStart);
        const markupParser = new MarkupParser(tokens, parser.getSource());
        if (parser.isTolerant()) markupParser.enableTolerant();
        const result = whenBranchParse(branchName, markupParser);
        if (!markupParser.isAtEnd()) return envelope.markupString.trim();
        return result;
      } catch {
        return envelope.markupString.trim();
      }
    }
    case 'else':
      return '';
    default:
      return assertNever(branchName);
  }
}

export function peekTagName(parser: ParserBase): string | null {
  if (!parser.check(TokenType.LiquidTagOpen)) return null;
  const inner = parser.check(TokenType.Text, 1)
    ? parser
        .getSource()
        .slice(
          parser.tokenAt(parser.getPosition() + 1).start,
          parser.tokenAt(parser.getPosition() + 1).end,
        )
    : '';
  const trimmed = inner.trimStart();
  const firstWs = trimmed.search(/\s/);
  return firstWs === -1 ? trimmed.trim() : trimmed.slice(0, firstWs);
}

export function isBlockTerminator(parser: ParserBase): boolean {
  if (!parser.check(TokenType.LiquidTagOpen)) return false;
  const tagName = peekTagName(parser);
  if (!tagName) return false;
  return (
    tagName.startsWith('end') || tagName === 'elsif' || tagName === 'else' || tagName === 'when'
  );
}

/**
 * A block-body iteration that consumed no tokens means the current token is one
 * the block can neither absorb nor close (e.g. an orphan `{% endwhen %}` naming a
 * branch keyword rather than a registered tag); looping again would spin forever.
 * In strict mode this throws a clean parse error; tolerant callers should break
 * and let the graceful "unclosed" return degrade the result.
 */
function throwUnexpectedBlockTag(parser: ParserBase, parentName: string): never {
  const tok = parser.peek();
  const tagName = peekTagName(parser);
  throw new LiquidHTMLASTParsingError(
    `Unexpected Liquid tag '${tagName ?? tok.type}' inside LiquidTag '${parentName}'`,
    parser.getSource(),
    tok.start,
    tok.end,
  );
}

export function consumeEndTag(parser: ParserBase): {
  position: Position;
  whitespace: { start: LiquidOpenWhitespace; end: LiquidCloseWhitespace };
} {
  const openToken = parser.consume(TokenType.LiquidTagOpen);
  parser.accept(TokenType.Text);
  const closeToken = parser.consume(TokenType.LiquidTagClose);
  const wsStart: LiquidOpenWhitespace = openToken.end - openToken.start > 2 ? '-' : '';
  const wsEnd: LiquidCloseWhitespace = closeToken.end - closeToken.start > 2 ? '-' : '';
  return {
    position: { start: openToken.start, end: closeToken.end },
    whitespace: { start: wsStart, end: wsEnd },
  };
}

export function isBranchName(value: string | null | undefined): value is BranchName {
  return value === 'elsif' || value === 'else' || value === 'when';
}

const CONDITIONAL_TAGS = new Set(['if', 'unless', 'case']);
