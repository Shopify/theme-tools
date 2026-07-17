import { ParserBase } from './base';
import {
  makeRawMarkup,
  makeTextNode,
  makeLiquidRawTag,
  makeLiquidTagBaseCase,
  makeLiquidTagNamed,
  makeLiquidBranchUnnamed,
  makeLiquidBranchNamed,
} from './factories';
import type { LiquidTagEnvelope } from './factories';
import type { Position } from '../types';
import type {
  LiquidStatement,
  LiquidRawTag,
  LiquidTag,
  LiquidBranch,
  LiquidBranchUnnamed,
  LiquidBranchNamed,
  LiquidNode,
  TextNode,
} from '../ast';
import type {
  LiquidLineContext,
  TagDefinitionBlock,
  TagDefinitionRaw,
  TagDefinitionHybrid,
  BranchName,
  Environment,
  Parser,
} from '../environment';
import { TagKind } from '../environment';
import { LiquidHTMLASTParsingError } from '../errors';
import { assertNever } from '../utils';
import { MarkupParser } from '../markup/parser';
import { tokenizeMarkup } from '../markup/tokenizer';
import { elsifBranchParse } from '../tags/if';
import { whenBranchParse } from '../tags/case';
import { envelopeFromLine } from '../shared';
import { isBranchName, finalizeBranch } from './liquid-blocks';
import { ChildFilterMode, filterChildren } from './tree-builder';
import { rawMarkupKindForTag } from './liquid-raw';

/**
 * Interface capturing what line-based parsing free functions need from
 * the DocumentParser. The parser class satisfies this contract, keeping
 * the coupling explicit and narrow.
 */
export interface LineParserDelegate extends ParserBase, Parser {
  readonly lineEnv: Environment;
  readonly lineParseHtml: boolean;
  readonly lineAllowUnclosedDocumentNode: boolean;
}

// liquidStatement := tagName markup
export function parseLiquidStatement(
  parser: LineParserDelegate,
  tagName: string,
  markupString: string,
  markupOffset: number,
  ctx: LiquidLineContext,
): LiquidStatement {
  const line = ctx.lines[ctx.index - 1];
  const envelope = envelopeFromLine(line, parser.getSource());

  if (tagName === '#') {
    // Preserve the inline comment's inner indentation (`preserveMarkup`); only
    // the single separator space after `#` was stripped upstream.
    return makeLiquidTagBaseCase(envelope, undefined, undefined, undefined, undefined, true);
  }

  if (tagName.startsWith('end')) {
    throw new LiquidHTMLASTParsingError(
      `Unexpected end tag '${tagName}' in {% liquid %} block`,
      parser.getSource(),
      line.nameOffset,
      line.lineEnd,
    );
  }

  const def = parser.lineEnv.tagForName(tagName);

  if (!def) {
    return makeLiquidTagBaseCase(envelope);
  }

  switch (def.kind) {
    case TagKind.Tag: {
      let reason: string | undefined;
      try {
        const tokens = tokenizeMarkup(markupString, markupOffset);
        const markupParser = new MarkupParser(
          tokens,
          parser.getSource(),
          markupOffset,
          envelope.markupEnd,
        );
        if (parser.isTolerant()) markupParser.enableTolerant();

        const markup = def.parse(tagName, markupParser, parser);
        if (!markupParser.isAtEnd()) {
          return makeLiquidTagBaseCase(
            envelope,
            undefined,
            undefined,
            undefined,
            'unexpected tokens after markup',
          );
        }
        return makeLiquidTagNamed(envelope, markup);
      } catch (e) {
        reason = e instanceof Error ? e.message : 'unknown error';
        return makeLiquidTagBaseCase(envelope, undefined, undefined, undefined, reason);
      }
    }

    case TagKind.Block:
      return parseLineBlockTag(parser, def, envelope, markupString, markupOffset, ctx);

    case TagKind.Raw:
      return parseLineRawTag(parser, def, envelope, ctx);

    case TagKind.Hybrid:
      return parseLineHybridTag(parser, def, envelope, markupString, markupOffset, ctx);

    default:
      return assertNever(def);
  }
}

// lineBlockTag := tagName markup LF lineBlockBody | lineBranchedBody "end" tagName
export function parseLineBlockTag(
  parser: LineParserDelegate,
  def: TagDefinitionBlock,
  envelope: LiquidTagEnvelope,
  markupString: string,
  markupOffset: number,
  ctx: LiquidLineContext,
): LiquidTag {
  let markup: unknown;
  let markupParsed = false;
  let reason: string | undefined;
  try {
    const tokens = tokenizeMarkup(markupString, markupOffset);
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

  const endTagLength = 3 + envelope.tagName.length; // 'end' + tagName

  if (def.branches.length === 0) {
    const { children, endNameOffset } = parseLineBlockBody(parser, envelope.tagName, ctx);
    const endPosition: Position = { start: endNameOffset, end: endNameOffset + endTagLength };
    if (markupParsed) {
      return makeLiquidTagNamed(envelope, markup, children, endPosition, { start: '', end: '' });
    }
    return makeLiquidTagBaseCase(envelope, children, endPosition, { start: '', end: '' }, reason);
  }

  const { branches, endNameOffset } = parseLineBranchedBody(parser, envelope.tagName, def, ctx);
  const endPosition: Position = { start: endNameOffset, end: endNameOffset + endTagLength };
  if (markupParsed) {
    return makeLiquidTagNamed(envelope, markup, branches, endPosition, { start: '', end: '' });
  }
  return makeLiquidTagBaseCase(envelope, branches, endPosition, { start: '', end: '' }, reason);
}

// lineRawTag := tagName LF line* "end" tagName
export function parseLineRawTag(
  parser: LineParserDelegate,
  _def: TagDefinitionRaw,
  envelope: LiquidTagEnvelope,
  ctx: LiquidLineContext,
): LiquidRawTag {
  const tagName = envelope.tagName;
  const endTagName = `end${tagName}`;

  // lineEnd is the exclusive end of the line content (one past the last
  // non-whitespace character), which is the position of the `\n` itself.
  // The RawMarkup position starts at lineEnd, but the body string starts
  // one character later (skipping the `\n`) so the value text matches the
  // actual body content.
  const positionStartOffset =
    ctx.index > 0 && ctx.index <= ctx.lines.length
      ? ctx.lines[ctx.index - 1].lineEnd
      : envelope.blockStartPosition.end;
  const bodyContentStart =
    ctx.index > 0 && ctx.index <= ctx.lines.length
      ? ctx.lines[ctx.index - 1].lineEnd + 1
      : envelope.blockStartPosition.end;

  // `comment`/`doc` bodies balance nested opens of the same tag before
  // matching their end line, mirroring the document-path scan in
  // liquid-raw.ts (Ruby comment.rb v5.13.0 `comment_tag_depth`). A nested
  // `raw` block is carved out: `raw` is first-match and does not nest, so an
  // `endcomment`/`comment` word sitting on a line inside a raw body must not
  // affect the depth. Every other raw tag (`raw`, `javascript`, `schema`,
  // `style`) keeps the original first-match scan and stays byte-identical.
  const balanced = tagName === 'comment' || tagName === 'doc';
  let endLineIndex = -1;
  if (balanced) {
    let depth = 0;
    for (let i = ctx.index; i < ctx.lines.length; i++) {
      const name = ctx.lines[i].tagName;
      if (name === 'raw') {
        // Skip past the nested raw block; its body lines never affect depth.
        i++;
        while (i < ctx.lines.length && ctx.lines[i].tagName !== 'endraw') i++;
        continue;
      }
      if (name === tagName) {
        depth++;
      } else if (name === endTagName) {
        if (depth === 0) {
          endLineIndex = i;
          break;
        }
        depth--;
      }
    }
  } else {
    for (let i = ctx.index; i < ctx.lines.length; i++) {
      if (ctx.lines[i].tagName === endTagName) {
        endLineIndex = i;
        break;
      }
    }
  }

  if (endLineIndex === -1) {
    throw new LiquidHTMLASTParsingError(
      `Unclosed raw tag '${tagName}' in {% liquid %} block`,
      parser.getSource(),
      envelope.blockStartPosition.start,
      envelope.blockStartPosition.end,
    );
  }

  const endLine = ctx.lines[endLineIndex];
  const bodyEndOffset = endLine.nameOffset;
  const source = parser.getSource();
  const bodyString = source.slice(bodyContentStart, bodyEndOffset);

  // Build body nodes: a TextNode wrapping the body content, matching
  // the non-liquid path in parseRawTagBody (liquid-raw.ts).
  const bodyNodes: (LiquidNode | TextNode)[] =
    bodyContentStart < bodyEndOffset
      ? (filterChildren(
          ChildFilterMode.Syntactic,
          [makeTextNode(bodyString, bodyContentStart, bodyEndOffset, source)],
          source,
        ) as (LiquidNode | TextNode)[])
      : [];

  const body = makeRawMarkup(
    rawMarkupKindForTag(tagName, bodyString),
    bodyString,
    bodyNodes,
    positionStartOffset,
    bodyEndOffset,
    source,
  );

  const endPosition: Position = {
    start: endLine.nameOffset,
    end: endLine.nameOffset + endTagName.length,
  };
  ctx.index = endLineIndex + 1;

  return makeLiquidRawTag(envelope, body, endPosition, { start: '', end: '' });
}

// lineHybridTag := tagName markup (LF lineBlockBody "end" tagName)?
export function parseLineHybridTag(
  parser: LineParserDelegate,
  def: TagDefinitionHybrid,
  envelope: LiquidTagEnvelope,
  markupString: string,
  markupOffset: number,
  ctx: LiquidLineContext,
): LiquidTag {
  let markup: unknown;
  let markupParsed = false;
  let reason: string | undefined;
  try {
    const tokens = tokenizeMarkup(markupString, markupOffset);
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

  const endTagName = `end${envelope.tagName}`;
  let hasEndTag = false;
  let depth = 0;
  for (let i = ctx.index; i < ctx.lines.length; i++) {
    if (ctx.lines[i].tagName === envelope.tagName) {
      depth++;
    } else if (ctx.lines[i].tagName === endTagName) {
      if (depth === 0) {
        hasEndTag = true;
        break;
      }
      depth--;
    }
  }

  if (!hasEndTag) {
    if (markupParsed) {
      return makeLiquidTagNamed(envelope, markup);
    }
    return makeLiquidTagBaseCase(envelope, undefined, undefined, undefined, reason);
  }

  const { children, endNameOffset } = parseLineBlockBody(parser, envelope.tagName, ctx);
  const endTagLength = 3 + envelope.tagName.length; // 'end' + tagName
  const endPosition: Position = { start: endNameOffset, end: endNameOffset + endTagLength };
  if (markupParsed) {
    return makeLiquidTagNamed(envelope, markup, children, endPosition, { start: '', end: '' });
  }
  return makeLiquidTagBaseCase(envelope, children, endPosition, { start: '', end: '' }, reason);
}

// lineBlockBody := liquidStatement* "end" tagName
export function parseLineBlockBody(
  parser: LineParserDelegate,
  parentName: string,
  ctx: LiquidLineContext,
): { children: LiquidStatement[]; endNameOffset: number } {
  const children: LiquidStatement[] = [];

  while (ctx.index < ctx.lines.length) {
    const line = ctx.lines[ctx.index];

    if (line.tagName === `end${parentName}`) {
      ctx.index++;
      return { children, endNameOffset: line.nameOffset };
    }

    ctx.index++;
    children.push(parseLiquidStatement(parser, line.tagName, line.markup, line.markupOffset, ctx));
  }

  if (parser.lineAllowUnclosedDocumentNode) {
    const endNameOffset = ctx.lines.length > 0 ? ctx.lines[ctx.lines.length - 1].lineEnd : 0;
    return { children, endNameOffset };
  }

  throw new LiquidHTMLASTParsingError(
    `Unclosed block tag '${parentName}' in {% liquid %} block`,
    parser.getSource(),
    0,
    0,
  );
}

// lineBranchedBody := lineBranch+ "end" tagName
export function parseLineBranchedBody(
  parser: LineParserDelegate,
  parentName: string,
  def: TagDefinitionBlock,
  ctx: LiquidLineContext,
): { branches: LiquidBranch[]; endNameOffset: number } {
  const branches: LiquidBranch[] = [];
  const bodyStart = ctx.index > 0 ? ctx.lines[ctx.index - 1].lineEnd : 0;
  let currentBranch: LiquidBranchUnnamed | LiquidBranchNamed = makeLiquidBranchUnnamed(
    bodyStart,
    parser.getSource(),
  );
  let currentChildren: LiquidStatement[] = [];

  while (ctx.index < ctx.lines.length) {
    const line = ctx.lines[ctx.index];

    if (line.tagName === `end${parentName}`) {
      finalizeBranch(
        currentBranch,
        currentChildren,
        line.nameOffset,
        parser.getSource(),
        parser.lineParseHtml ? ChildFilterMode.StripEdges : ChildFilterMode.Syntactic,
      );
      branches.push(currentBranch);
      ctx.index++;
      return { branches, endNameOffset: line.nameOffset };
    }

    if (isBranchName(line.tagName) && def.branches.includes(line.tagName)) {
      finalizeBranch(
        currentBranch,
        currentChildren,
        line.nameOffset,
        parser.getSource(),
        parser.lineParseHtml ? ChildFilterMode.StripEdges : ChildFilterMode.Syntactic,
      );
      branches.push(currentBranch);

      const branchEnvelope = envelopeFromLine(line, parser.getSource());
      const branchMarkup = parseLineBranchMarkup(
        line.tagName as BranchName,
        branchEnvelope,
        parser.getSource(),
        parser.isTolerant(),
      );
      currentBranch = makeLiquidBranchNamed(branchEnvelope, branchMarkup);
      currentChildren = [];
      ctx.index++;
      continue;
    }

    ctx.index++;
    currentChildren.push(
      parseLiquidStatement(parser, line.tagName, line.markup, line.markupOffset, ctx),
    );
  }

  if (parser.lineAllowUnclosedDocumentNode) {
    const endNameOffset = ctx.lines.length > 0 ? ctx.lines[ctx.lines.length - 1].lineEnd : 0;
    finalizeBranch(
      currentBranch,
      currentChildren,
      endNameOffset,
      parser.getSource(),
      parser.lineParseHtml ? ChildFilterMode.StripEdges : ChildFilterMode.Syntactic,
    );
    branches.push(currentBranch);
    return { branches, endNameOffset };
  }

  throw new LiquidHTMLASTParsingError(
    `Unclosed block tag '${parentName}' in {% liquid %} block`,
    parser.getSource(),
    0,
    0,
  );
}

export function parseLineBranchMarkup(
  branchName: BranchName,
  envelope: LiquidTagEnvelope,
  source: string,
  tolerant: boolean = false,
): unknown {
  switch (branchName) {
    case 'elsif': {
      try {
        const tokens = tokenizeMarkup(envelope.markupString, envelope.markupOffset);
        const markupParser = new MarkupParser(tokens, source);
        if (tolerant) markupParser.enableTolerant();

        const result = elsifBranchParse(branchName, markupParser);
        if (!markupParser.isAtEnd()) return envelope.markupString.trim();
        return result;
      } catch {
        return envelope.markupString.trim();
      }
    }
    case 'when': {
      try {
        const tokens = tokenizeMarkup(envelope.markupString, envelope.markupOffset);
        const markupParser = new MarkupParser(tokens, source);
        if (tolerant) markupParser.enableTolerant();

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
