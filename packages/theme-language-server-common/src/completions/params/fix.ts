export const CURSOR = '█';

const SINGLE_QUOTE = `'` as const;
const DOUBLE_QUOTE = `"` as const;
const HTML_TOKENS: Token[] = ['<', '>'];
const SHOULD_IGNORE_HTML_TOKENS: Token[] = [SINGLE_QUOTE, DOUBLE_QUOTE, '{{', '{%'];

const QUOTES: Token[] = [SINGLE_QUOTE, DOUBLE_QUOTE];
const CONTROL_TOKENS: Token[] = ['{{', '{%', '<'];

const TokenPairs = {
  "'": "'",
  '"': '"',
  '{{': '}}',
  '{%': '%}',
  '<': '>',
  '[': ']',
  '(': ')',
} as const;

type Token = (typeof TokenPairs)[keyof typeof TokenPairs] | keyof typeof TokenPairs;

/**
 * Fix the source code and return the new fixed source with the new absolute
 * position
 *
 * @param source - source code
 * @param position - absolute position
 *
 * @returns new fixed source
 */
export function fix(source: string, position: number = source.length): string {
  const fixer = new Fixer(source, position);
  return fixer.fix();
}

class Fixer {
  public markup: string;

  /**
   * A list of quotes, <, [, etc. We'll pass through that list to determine
   * what needs to be closed at the end.
   */
  private tokens: Token[] = [];

  /**
   * A stack of closing tokens such that when we're done we simply pop
   * everything out into the string to get a fixed string.
   */
  private stack: Token[] = [];
  private cursor: number;

  constructor(source: string, position: number) {
    this.cursor = 0;
    this.markup = source.slice(0, position);
  }

  /**
   * This is cool, so bear with me.
   *
   * We'll scan the entire string up to the cursor position and turn that
   * into a list of tokens
   *
   * input:
   *   `<a href="hi'" other="{{ 'there'`
   *
   * output:
   *   - <
   *   - "
   *   - '
   *   - "
   *   - "
   *   - {{
   *   - '
   *   - '
   *   - }}
   *   - "
   *
   * Then we take that output, and we turn it into a stack
   * (open tokens push, close tokens pop)
   *
   * stack evolution:
   *   - <         # open tag
   *   - < "       # add quote
   *   - < "       # (single quote is ignored)
   *   - <         # close quote
   *   - < "       # open new quote
   *   - < " {{    # open liquid variable output
   *   - < " {{ '  # open liquid string in variable output
   *   - < " {{    # close liquid string in variable output
   *
   * then we pop the close characters of that stack onto the string and
   * have a fixed string
   *
   *   - <a href="hi'" other="{{ 'there'      # start
   *   - <a href="hi'" other="{{ 'there'}}    # pop close {{
   *   - <a href="hi'" other="{{ 'there'}}"   # pop close "
   *   - <a href="hi'" other="{{ 'there'}}">  # pop close <
   *
   * And there we go, we have a fixed string.
   */
  fix() {
    this.scanTokens();
    this.buildStack();
    let markup = this.markup;

    if (this.shouldIncludeCursorPlaceholder()) {
      markup += CURSOR;
    }

    while (this.stack.length !== 0) {
      markup += this.stack.pop();
    }

    return markup;
  }

  buildStack() {
    for (let token of this.tokens) {
      if (this.shouldPanic(token)) {
        while (token !== this.stack.pop()) {}
      } else if (this.shouldSkipToken(token)) {
        /* do nothing */
      } else if (this.isClosingToken(token)) {
        this.stack.pop();
      } else {
        const closingToken = TokenPairs[token as keyof typeof TokenPairs];
        if (closingToken) {
          this.stack.push(closingToken);
        }
      }
    }
  }

  isClosingToken(token: Token) {
    return this.current === token;
  }

  shouldPanic(token: Token) {
    const isInStringContext = QUOTES.includes(this.current as any);
    return isInStringContext && this.stack.at(-2) === token;
  }

  shouldSkipToken(token: Token) {
    const current = this.current;
    const isInTextContext = !current;
    const isInStringContext = QUOTES.includes(current as any);
    const isInLiquidContext = this.stack.includes('}}') || this.stack.includes('%}');
    return (
      (isInTextContext && !CONTROL_TOKENS.includes(token)) ||
      (isInStringContext && !CONTROL_TOKENS.includes(token) && !QUOTES.includes(token)) ||
      (isInLiquidContext && token === '<') ||
      (current === SINGLE_QUOTE && token === DOUBLE_QUOTE) ||
      (current === DOUBLE_QUOTE && token === SINGLE_QUOTE) ||
      (SHOULD_IGNORE_HTML_TOKENS.includes(current!) && HTML_TOKENS.includes(token))
    );
  }

  scanTokens() {
    while (!this.isAtEnd()) {
      const character = this.peek();
      switch (character) {
        case DOUBLE_QUOTE:
        case SINGLE_QUOTE:
        case '(':
        case ')':
        case '[':
        case ']': {
          this.pushToken(character);
          break;
        }

        case '{': {
          if (this.matchNext('%')) {
            this.pushToken('{%');
          } else if (this.matchNext('{')) {
            this.pushToken('{{');
          }
          break;
        }

        case '%': {
          if (this.matchNext('}')) {
            this.pushToken('%}');
          }
          break;
        }

        case '}': {
          if (this.matchNext('}')) {
            this.pushToken('}}');
          }
          break;
        }

        case '<': {
          if (this.testNext(/[a-z{\/]/i)) {
            this.pushToken('<');
          }
          break;
        }

        case '>': {
          this.pushToken('>');
          break;
        }

        default: {
          /* do nothing */
        }
      }

      this.advance();
    }
  }

  shouldIncludeCursorPlaceholder() {
    const prevCharacter = this.markup.at(-1) ?? '';
    const prevPrevCharacter = this.markup.at(-2) ?? '';
    const isInLiquidContext = this.stack.includes('%}') || this.stack.includes('}}');
    const isInHtmlContext = this.current === '>';
    const isInStringContext = QUOTES.includes(this.current as any);
    return (
      (isInStringContext && this.stack.at(-2) === '>' && QUOTES.includes(prevCharacter as any)) ||
      (isInHtmlContext &&
        (/\s/.test(prevCharacter) ||
          prevCharacter === '<' ||
          (prevPrevCharacter === '<' && prevCharacter === '/') ||
          (prevPrevCharacter === '%' && prevCharacter === '}'))) ||
      (isInLiquidContext &&
        ((!isInStringContext && [' ', '\t', '\n', '.', '{', '[', ','].includes(prevCharacter)) ||
          (isInStringContext && prevPrevCharacter === '[')))
    );
  }

  get current() {
    return this.stack.at(-1);
  }

  advance() {
    this.cursor += 1;
  }

  matchNext(character: string) {
    if (this.peekNext() !== character) return false;
    this.cursor++;
    return true;
  }

  testNext(regex: RegExp) {
    return regex.test(this.peekNext());
  }

  peek(cursor = this.cursor) {
    return this.markup[cursor];
  }

  peekNext(cursor = this.cursor) {
    return this.markup[cursor + 1];
  }

  pushToken(token: Token) {
    this.tokens.push(token);
  }

  isAtEnd() {
    return this.cursor >= this.markup.length;
  }
}
