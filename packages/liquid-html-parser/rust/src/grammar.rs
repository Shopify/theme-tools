//! Port of the parts of `src/grammar.ts` the document parser uses.

pub const BLOCKS: [&str; 11] = [
    "if",
    "unless",
    "for",
    "case",
    "tablerow",
    "capture",
    "form",
    "paginate",
    "block",
    "ifchanged",
    "partial",
];

pub const VOID_ELEMENTS: [&str; 16] = [
    "area", "base", "br", "col", "command", "embed", "hr", "img", "input", "keygen", "link",
    "meta", "param", "source", "track", "wbr",
];

pub const HTML_RAW_TAGS: [&str; 3] = ["script", "style", "svg"];
