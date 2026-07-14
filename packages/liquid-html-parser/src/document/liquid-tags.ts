import { TokenType } from './tokenizer';
import type { Token } from './tokenizer';
import { envelopeFromTokens, makeLiquidTagBaseCase, makeLiquidTagNamed } from './factories';
import type { LiquidTagEnvelope } from './factories';
import type { LiquidRawTag, LiquidTag } from '../ast';
import type { TagDefinition, TagDefinitionTag } from '../environment';
import { TagKind } from '../environment';
import { LiquidHTMLASTParsingError } from '../errors';
import { assertNever } from '../utils';
import { MarkupParser } from '../markup/parser';
import { tokenizeMarkup } from '../markup/tokenizer';
import { parseBlockTag } from './liquid-blocks';
import type { BlockParserDelegate } from './liquid-blocks';
import { parseRawTag } from './liquid-raw';
import type { RawParserDelegate } from './liquid-raw';
import { parseHybridTag } from './liquid-hybrid';

/**
 * Interface capturing what the liquid-tag dispatch function needs from
 * the DocumentParser. The parser class satisfies this contract, keeping
 * the coupling explicit and narrow.
 */
export interface TagParserDelegate extends BlockParserDelegate, RawParserDelegate {
  tagForName(name: string): TagDefinition | undefined;
}

// liquidTag := "{%" tagName markup "%}" (block | raw | hybrid)?
export function parseLiquidTag(parser: TagParserDelegate): LiquidTag | LiquidRawTag {
  const openToken = parser.consume(TokenType.LiquidTagOpen);
  parser.accept(TokenType.Text);
  const closeToken = parser.consume(TokenType.LiquidTagClose);

  const envelope = envelopeFromTokens(openToken, closeToken, parser.getSource());

  if (envelope.tagName.startsWith('#')) {
    const commentMarkup = envelope.tagName.slice(1) + envelope.markupString;
    const commentMarkupOffset = envelope.markupEnd - commentMarkup.length;
    return makeLiquidTagBaseCase({
      ...envelope,
      tagName: '#',
      markupString: commentMarkup,
      markupOffset: commentMarkupOffset,
    });
  }

  if (envelope.tagName.startsWith('end')) {
    const innerName = envelope.tagName.slice(3);
    const innerDef = parser.tagForName(innerName);
    if (innerDef) {
      throw new LiquidHTMLASTParsingError(
        `Attempting to close LiquidTag '${innerName}' before it was opened without a matching '${innerName}'`,
        parser.getSource(),
        openToken.start,
        closeToken.end,
      );
    }
  }

  const def = parser.tagForName(envelope.tagName);

  if (!def) {
    return makeLiquidTagBaseCase(envelope);
  }

  switch (def.kind) {
    case TagKind.Tag:
      return parseStandaloneTag(parser, def, envelope, closeToken);

    case TagKind.Block:
      return parseBlockTag(parser, def, envelope, closeToken);

    case TagKind.Raw:
      return parseRawTag(parser, def, envelope, closeToken);

    case TagKind.Hybrid:
      return parseHybridTag(parser, def, envelope, closeToken);

    default:
      return assertNever(def);
  }
}

// standaloneTag := "{%" tagName markup "%}"
function parseStandaloneTag(
  parser: TagParserDelegate,
  def: TagDefinitionTag,
  envelope: LiquidTagEnvelope,
  closeToken: Token,
): LiquidTag {
  let reason: string | undefined;
  try {
    const markupStringStart = closeToken.start - envelope.markupString.length;
    const markupStringEnd = markupStringStart + envelope.markupString.length;
    const tokens = tokenizeMarkup(envelope.markupString, markupStringStart);
    const markupParser = new MarkupParser(
      tokens,
      parser.getSource(),
      markupStringStart,
      markupStringEnd,
    );
    const markup = def.parse(envelope.tagName, markupParser, parser);
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
