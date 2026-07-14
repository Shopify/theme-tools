import { TokenType } from './tokenizer';
import { ParserBase } from './base';
import { makeLiquidVariableOutput } from './factories';
import { MarkupParser } from '../markup/parser';
import { tokenizeMarkup } from '../markup/tokenizer';
import type { LiquidVariableOutput } from '../ast';

// liquidVariableOutput := "{{" liquidVariable "}}"
export function parseLiquidVariableOutput(parser: ParserBase): LiquidVariableOutput {
  const openToken = parser.consume(TokenType.LiquidVariableOutputOpen);
  parser.accept(TokenType.Text);
  const closeToken = parser.consume(TokenType.LiquidVariableOutputClose);

  const source = parser.getSource();
  const rawMarkup = source.slice(openToken.end, closeToken.start);

  try {
    const tokens = tokenizeMarkup(rawMarkup, openToken.end);
    const markupParser = new MarkupParser(tokens, source);
    const liquidVariable = markupParser.liquidVariable();

    if (!markupParser.isAtEnd()) {
      return makeLiquidVariableOutput(openToken, closeToken, rawMarkup.trim(), source);
    }

    return makeLiquidVariableOutput(openToken, closeToken, liquidVariable, source);
  } catch {
    return makeLiquidVariableOutput(openToken, closeToken, rawMarkup.trim(), source);
  }
}
