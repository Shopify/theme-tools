import { NodeTypes } from '@shopify/liquid-html-parser';
import type {
  AssignMarkup as ParserAssignMarkup,
  ComplexLiquidExpression as ParserComplexLiquidExpression,
  ContentForMarkup as ParserContentForMarkup,
  CycleMarkup as ParserCycleMarkup,
  ForMarkup as ParserForMarkup,
  LiquidArgument as ParserLiquidArgument,
  LiquidBranch as ParserLiquidBranch,
  LiquidConditionalExpression as ParserLiquidConditionalExpression,
  LiquidExpression as ParserLiquidExpression,
  LiquidRawTag as ParserLiquidRawTag,
  LiquidTag as ParserLiquidTag,
  LiquidVariable as ParserLiquidVariable,
  LiquidVariableOutput as ParserLiquidVariableOutput,
  PaginateMarkup as ParserPaginateMarkup,
  Position,
  RenderMarkup as ParserRenderMarkup,
} from '@shopify/liquid-html-parser';

export { NodeTypes };

type WithMarkupPosition<T> = T & { markupPosition: Position };

export type AssignMarkup = ParserAssignMarkup;
export type ComplexLiquidExpression = ParserComplexLiquidExpression;
export type ContentForMarkup = ParserContentForMarkup;
export type CycleMarkup = ParserCycleMarkup;
export type ForMarkup = ParserForMarkup;
export type LiquidArgument = ParserLiquidArgument;
export type LiquidBranch = WithMarkupPosition<ParserLiquidBranch>;
export type LiquidConditionalExpression = ParserLiquidConditionalExpression;
export type LiquidExpression = ParserLiquidExpression;
export type LiquidRawTag = WithMarkupPosition<ParserLiquidRawTag>;
export type LiquidTag = WithMarkupPosition<ParserLiquidTag>;
export type LiquidVariable = ParserLiquidVariable;
export type LiquidVariableOutput = WithMarkupPosition<ParserLiquidVariableOutput>;
export type PaginateMarkup = ParserPaginateMarkup;
export type RenderMarkup = ParserRenderMarkup;
export type SectionMarkup = { args: LiquidArgument[] };

export enum TokenType {
  Text = 'Text',
  LiquidTagOpen = 'LiquidTagOpen',
  LiquidTagClose = 'LiquidTagClose',
  LiquidVariableOutputOpen = 'LiquidVariableOutputOpen',
  LiquidVariableOutputClose = 'LiquidVariableOutputClose',
}

export enum MarkupTokenType {
  Id = 'Id',
  Comma = 'Comma',
  Colon = 'Colon',
  Equality = 'Equality',
  Pipe = 'Pipe',
  EndOfString = 'EndOfString',
  Other = 'Other',
}

export interface Token {
  type: TokenType;
  start: number;
  end: number;
}

export interface MarkupToken {
  type: MarkupTokenType;
  value: string;
  start: number;
  end: number;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const pattern = /({[{%]-?|-?[}%]})/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) {
      tokens.push({ type: TokenType.Text, start: lastIndex, end: match.index });
    }

    tokens.push({
      type: tokenTypeForDelimiter(match[0]),
      start: match.index,
      end: match.index + match[0].length,
    });
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < source.length) {
    tokens.push({ type: TokenType.Text, start: lastIndex, end: source.length });
  }

  return tokens;
}

export function tokenizeMarkup(markup: string): MarkupToken[] {
  const tokens: MarkupToken[] = [];
  const pattern =
    /\s+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_-]*|==|!=|<=|>=|\.\.|[=,:|.[\]()]|-/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markup))) {
    const value = match[0];
    if (/^\s+$/.test(value)) continue;

    tokens.push({
      type: markupTokenType(value),
      value,
      start: match.index,
      end: match.index + value.length,
    });
  }

  tokens.push({
    type: MarkupTokenType.EndOfString,
    value: '',
    start: markup.length,
    end: markup.length,
  });

  return tokens;
}

export class MarkupParser {
  private index = 0;

  constructor(
    private readonly tokens: MarkupToken[],
    private readonly source: string,
  ) {}

  consume(type: MarkupTokenType) {
    const token = this.tokens[this.index];
    if (token?.type !== type) throw new Error(`Expected ${type}`);
    this.index++;
    return token;
  }

  consumeOptional(type: MarkupTokenType) {
    const token = this.tokens[this.index];
    if (token?.type !== type) return undefined;
    this.index++;
    return token;
  }

  id(value: string) {
    const token = this.tokens[this.index];
    if (token?.type !== MarkupTokenType.Id || token.value !== value) return false;
    this.index++;
    return true;
  }

  valueExpression() {
    const token = this.tokens[this.index];
    if (!token || token.type === MarkupTokenType.EndOfString) {
      throw new Error('Expected value expression');
    }
    this.index++;
    return token;
  }

  namedArgument() {
    this.valueExpression();
  }

  namedArguments() {
    while (!this.isAtEnd()) {
      this.namedArgument();
      this.consumeOptional(MarkupTokenType.Comma);
    }
  }

  isAtEnd() {
    return this.tokens[this.index]?.type === MarkupTokenType.EndOfString;
  }
}

function tokenTypeForDelimiter(delimiter: string): TokenType {
  if (delimiter.startsWith('{{')) return TokenType.LiquidVariableOutputOpen;
  if (delimiter.endsWith('}}')) return TokenType.LiquidVariableOutputClose;
  if (delimiter.startsWith('{%')) return TokenType.LiquidTagOpen;
  return TokenType.LiquidTagClose;
}

function markupTokenType(value: string): MarkupTokenType {
  if (value === ',') return MarkupTokenType.Comma;
  if (value === ':') return MarkupTokenType.Colon;
  if (value === '|') return MarkupTokenType.Pipe;
  if (value === '=') return MarkupTokenType.Equality;
  if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value)) return MarkupTokenType.Id;
  return MarkupTokenType.Other;
}
