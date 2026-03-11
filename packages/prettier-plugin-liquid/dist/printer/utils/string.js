"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimEnd = exports.trim = void 0;
exports.isWhitespace = isWhitespace;
exports.bodyLines = bodyLines;
exports.markupLines = markupLines;
exports.reindent = reindent;
exports.originallyHadLineBreaks = originallyHadLineBreaks;
exports.hasLineBreakInRange = hasLineBreakInRange;
exports.hasMoreThanOneNewLineBetweenNodes = hasMoreThanOneNewLineBetweenNodes;
function isWhitespace(source, loc) {
    if (loc < 0 || loc >= source.length)
        return false;
    return !!source[loc].match(/\s/);
}
const trim = (x) => x.trim();
exports.trim = trim;
const trimEnd = (x) => x.trimEnd();
exports.trimEnd = trimEnd;
function bodyLines(str) {
    return str
        .replace(/^(?: |\t)*(\r?\n)*|\s*$/g, '') // only want the meat
        .split(/\r?\n/);
}
function markupLines(markup) {
    return markup.trim().split('\n');
}
function reindent(lines, skipFirst = false) {
    const minIndentLevel = lines
        .filter((_, i) => (skipFirst ? i > 0 : true))
        .filter((line) => line.trim().length > 0)
        .map((line) => line.match(/^\s*/)[0].length)
        .reduce((a, b) => Math.min(a, b), Infinity);
    if (minIndentLevel === Infinity) {
        return lines;
    }
    const indentStrip = new RegExp('^' + '\\s'.repeat(minIndentLevel));
    return lines.map((line) => line.replace(indentStrip, '')).map(exports.trimEnd);
}
function originallyHadLineBreaks(path, { locStart, locEnd }) {
    const node = path.getValue();
    return hasLineBreakInRange(node.source, locStart(node), locEnd(node));
}
function hasLineBreakInRange(source, locStart, locEnd) {
    const indexOfNewLine = source.indexOf('\n', locStart);
    return 0 <= indexOfNewLine && indexOfNewLine < locEnd;
}
function hasMoreThanOneNewLineBetweenNodes(source, prev, next) {
    if (!prev || !next)
        return false;
    const between = source.slice(prev.position.end, next.position.start);
    const count = between.match(/\n/g)?.length || 0;
    return count > 1;
}
//# sourceMappingURL=string.js.map