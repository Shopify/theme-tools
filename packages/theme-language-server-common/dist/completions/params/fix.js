"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURSOR = void 0;
exports.fix = fix;
exports.CURSOR = '█';
const SINGLE_QUOTE = `'`;
const DOUBLE_QUOTE = `"`;
const HTML_TOKENS = ['<', '>'];
const SHOULD_IGNORE_HTML_TOKENS = [SINGLE_QUOTE, DOUBLE_QUOTE, '{{', '{%'];
const QUOTES = [SINGLE_QUOTE, DOUBLE_QUOTE];
const CONTROL_TOKENS = ['{{', '{%', '<'];
const TokenPairs = {
    "'": "'",
    '"': '"',
    '{{': '}}',
    '{%': '%}',
    '<': '>',
    '[': ']',
    '(': ')',
};
/**
 * Fix the source code and return the new fixed source with the new absolute
 * position
 *
 * @param source - source code
 * @param position - absolute position
 *
 * @returns new fixed source
 */
function fix(source, position = source.length) {
    const fixer = new Fixer(source, position);
    return fixer.fix();
}
class Fixer {
    constructor(source, position) {
        /**
         * A list of quotes, <, [, etc. We'll pass through that list to determine
         * what needs to be closed at the end.
         */
        this.tokens = [];
        /**
         * A stack of closing tokens such that when we're done we simply pop
         * everything out into the string to get a fixed string.
         */
        this.stack = [];
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
            markup += exports.CURSOR;
        }
        while (this.stack.length !== 0) {
            markup += this.stack.pop();
        }
        return markup;
    }
    buildStack() {
        for (let token of this.tokens) {
            if (this.shouldPanic(token)) {
                while (token !== this.stack.pop()) { }
            }
            else if (this.shouldSkipToken(token)) {
                /* do nothing */
            }
            else if (this.isClosingToken(token)) {
                this.stack.pop();
            }
            else {
                const closingToken = TokenPairs[token];
                if (closingToken) {
                    this.stack.push(closingToken);
                }
            }
        }
    }
    isClosingToken(token) {
        return this.current === token;
    }
    shouldPanic(token) {
        const isInStringContext = QUOTES.includes(this.current);
        return isInStringContext && this.stack.at(-2) === token;
    }
    shouldSkipToken(token) {
        const current = this.current;
        const isInTextContext = !current;
        const isInStringContext = QUOTES.includes(current);
        const isInLiquidContext = this.stack.includes('}}') || this.stack.includes('%}');
        return ((isInTextContext && !CONTROL_TOKENS.includes(token)) ||
            (isInStringContext && !CONTROL_TOKENS.includes(token) && !QUOTES.includes(token)) ||
            (isInLiquidContext && token === '<') ||
            (current === SINGLE_QUOTE && token === DOUBLE_QUOTE) ||
            (current === DOUBLE_QUOTE && token === SINGLE_QUOTE) ||
            (SHOULD_IGNORE_HTML_TOKENS.includes(current) && HTML_TOKENS.includes(token)));
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
                    }
                    else if (this.matchNext('{')) {
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
        var _a, _b;
        const prevCharacter = (_a = this.markup.at(-1)) !== null && _a !== void 0 ? _a : '';
        const prevPrevCharacter = (_b = this.markup.at(-2)) !== null && _b !== void 0 ? _b : '';
        const isInLiquidContext = this.stack.includes('%}') || this.stack.includes('}}');
        const isInHtmlContext = this.current === '>';
        const isInStringContext = QUOTES.includes(this.current);
        return ((isInStringContext && this.stack.at(-2) === '>' && QUOTES.includes(prevCharacter)) ||
            (isInHtmlContext &&
                (/\s/.test(prevCharacter) ||
                    prevCharacter === '<' ||
                    (prevPrevCharacter === '<' && prevCharacter === '/') ||
                    (prevPrevCharacter === '%' && prevCharacter === '}'))) ||
            (isInLiquidContext &&
                ((!isInStringContext && [' ', '\t', '\n', '.', '{', '[', ','].includes(prevCharacter)) ||
                    (isInStringContext && prevPrevCharacter === '['))));
    }
    get current() {
        return this.stack.at(-1);
    }
    advance() {
        this.cursor += 1;
    }
    matchNext(character) {
        if (this.peekNext() !== character)
            return false;
        this.cursor++;
        return true;
    }
    testNext(regex) {
        return regex.test(this.peekNext());
    }
    peek(cursor = this.cursor) {
        return this.markup[cursor];
    }
    peekNext(cursor = this.cursor) {
        return this.markup[cursor + 1];
    }
    pushToken(token) {
        this.tokens.push(token);
    }
    isAtEnd() {
        return this.cursor >= this.markup.length;
    }
}
//# sourceMappingURL=fix.js.map