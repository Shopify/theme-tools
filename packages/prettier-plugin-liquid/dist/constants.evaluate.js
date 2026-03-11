"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSS_WHITE_SPACE_LIQUID_TAGS = exports.CSS_WHITE_SPACE_DEFAULT = exports.CSS_WHITE_SPACE_TAGS = exports.CSS_DISPLAY_DEFAULT = exports.CSS_DISPLAY_LIQUID_DEFAULT = exports.CSS_DISPLAY_LIQUID_TAGS = exports.CSS_DISPLAY_TAGS = void 0;
// This code is adapted from prettier/src/language-html/constants.evaluate.js
const htmlStyles = require('html-styles');
const getCssStyleTags = (property) => Object.fromEntries(htmlStyles
    .filter((htmlStyle) => htmlStyle.style[property])
    .flatMap((htmlStyle) => htmlStyle.selectorText
    .split(',')
    .map((selector) => selector.trim())
    .filter((selector) => /^[\dA-Za-z]+$/.test(selector))
    .map((tagName) => [tagName, htmlStyle.style[property]])));
exports.CSS_DISPLAY_TAGS = {
    ...getCssStyleTags('display'),
    // TODO: send PR to upstream
    button: 'inline-block',
    // special cases for some css display=none elements
    template: 'inline',
    source: 'block',
    track: 'block',
    script: 'block',
    param: 'block',
    // `noscript` is inline
    // noscript: "inline",
    // there's no css display for these elements but they behave these ways
    details: 'block',
    summary: 'block',
    dialog: 'block',
    meter: 'inline-block',
    progress: 'inline-block',
    object: 'inline-block',
    video: 'inline-block',
    audio: 'inline-block',
    select: 'inline-block',
    option: 'block',
    optgroup: 'block',
};
exports.CSS_DISPLAY_LIQUID_TAGS = {
    // control flow tags
    if: 'inline',
    unless: 'inline',
    else: 'inline',
    elsif: 'inline',
    case: 'inline',
    when: 'inline',
    // iteration tags,
    for: 'inline',
    cycle: 'inline',
    tablerow: 'block',
    break: 'none',
    continue: 'none',
    // theme tags
    comment: 'none',
    echo: 'inline',
    form: 'block',
    layout: 'none',
    liquid: 'inline',
    paginate: 'inline',
    raw: 'inline',
    render: 'inline',
    include: 'inline',
    section: 'block',
    style: 'none',
    // variable tags
    assign: 'none',
    capture: 'inline',
    increment: 'inline',
    decrement: 'inline',
};
exports.CSS_DISPLAY_LIQUID_DEFAULT = 'inline';
exports.CSS_DISPLAY_DEFAULT = 'inline';
exports.CSS_WHITE_SPACE_TAGS = getCssStyleTags('white-space');
exports.CSS_WHITE_SPACE_DEFAULT = 'normal';
exports.CSS_WHITE_SPACE_LIQUID_TAGS = {
    capture: 'pre',
    raw: 'pre',
};
//# sourceMappingURL=constants.evaluate.js.map