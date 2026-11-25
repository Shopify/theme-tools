//! Port of `document/raw-body.ts` and the body rules in `tags/raw.ts`.

use crate::lines::LiquidLine;

/// What an inner tag with the same name does.
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum SameName {
    Nests,
    Ignored,
    Rejected,
}

/// `RawBodyRule`: how a raw tag's body ends, following the Liquid tag class that parses it.
pub(crate) struct RawBodyRule {
    /// `leading` reads a tag's name at the start of a `{% %}` token (`BlockBody::FullToken`);
    /// `trailing` reads the last tag in the token (`FullTokenPossiblyInvalid`).
    leading: bool,
    same_name: SameName,
    /// Inner tags whose bodies are skipped whole, each ending by its own rule.
    opaque: &'static [&'static str],
    closes_in_liquid_tag: bool,
}

/// `Liquid::Raw`: raw, and liquid_extensions' javascript, schema and stylesheet.
const LIQUID_RAW_BODY: RawBodyRule = RawBodyRule {
    leading: false,
    same_name: SameName::Ignored,
    opaque: &[],
    closes_in_liquid_tag: false,
};

/// `Liquid::Doc` reads tags like `Liquid::Raw` but rejects a nested `doc`.
const LIQUID_DOC_BODY: RawBodyRule = RawBodyRule {
    same_name: SameName::Rejected,
    ..LIQUID_RAW_BODY
};

/// `Liquid::Comment#parse_body` counts nested comments and skips `raw` bodies.
const LIQUID_COMMENT_BODY: RawBodyRule = RawBodyRule {
    leading: true,
    same_name: SameName::Nests,
    opaque: &["raw"],
    closes_in_liquid_tag: true,
};

/// Shopify's `style` tag is a `Liquid::Block`: it nests, and the raw tags inside it end by their
/// own rules.
const LIQUID_BLOCK_BODY: RawBodyRule = RawBodyRule {
    leading: true,
    same_name: SameName::Nests,
    opaque: &[
        "comment",
        "doc",
        "javascript",
        "raw",
        "schema",
        "stylesheet",
    ],
    closes_in_liquid_tag: true,
};

/// The body rule of a raw tag.
pub(crate) fn rule_for(name: &str) -> Option<&'static RawBodyRule> {
    Some(match name {
        "raw" | "javascript" | "schema" | "stylesheet" => &LIQUID_RAW_BODY,
        "doc" => &LIQUID_DOC_BODY,
        "comment" => &LIQUID_COMMENT_BODY,
        "style" => &LIQUID_BLOCK_BODY,
        _ => return None,
    })
}

/// `!def.parseLiquidInBody`: a body that's one text node (or `doc`'s own parse).
pub(crate) fn is_literal(name: &str) -> bool {
    matches!(name, "raw" | "comment" | "schema" | "doc")
}

/// The closing tag of a raw tag's body, as source offsets, and its whitespace-stripping dashes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct RawBodyEnd {
    pub tag_start: usize,
    pub tag_end: usize,
    pub ws_start: bool,
    pub ws_end: bool,
}

/// Ruby's ASCII `\s`.
fn is_ruby_space(c: u8) -> bool {
    matches!(c, b' ' | b'\t' | b'\n' | 0x0b | 0x0c | b'\r')
}

fn word_len(s: &[u8]) -> usize {
    s.iter()
        .take_while(|c| c.is_ascii_alphanumeric() || **c == b'_')
        .count()
}

/// `/\{%-?[ \t\n\v\f\r]*(\w+)/y` at `at`: the name, if any.
fn tag_name_at(token: &str, at: usize, allow_hash: bool) -> Option<&str> {
    let b = token.as_bytes();
    let mut i = at + 2;
    if b.get(i) == Some(&b'-') {
        i += 1;
    }
    while b.get(i).is_some_and(|c| is_ruby_space(*c)) {
        i += 1;
    }
    let n = if allow_hash && b.get(i) == Some(&b'#') {
        1
    } else {
        word_len(&b[i..])
    };
    (n > 0).then(|| &token[i..i + n])
}

/// `liquidTagTokenName`: the name a whole `{% … %}` token opens (`BlockBody::FullToken`).
pub(crate) fn liquid_tag_token_name(token: &str) -> Option<&str> {
    if token.len() < 4 || !token.starts_with("{%") || !token.ends_with("%}") {
        return None;
    }
    tag_name_at(token, 0, true)
}

/// The tag a token names, and where that tag starts in the token.
fn token_tag(token: &str, leading: bool) -> Option<(&str, usize)> {
    if !token.ends_with("%}") {
        return None;
    }
    if leading {
        return liquid_tag_token_name(token).map(|n| (n, 0));
    }
    // Raw accepts the last tag opener in a token, including one inside an unfinished output.
    let mut end = token.len() - 1;
    while let Some(at) = token[..end].rfind("{%") {
        if let Some(name) = tag_name_at(token, at, false) {
            return Some((name, at));
        }
        end = at + 1;
        if at == 0 {
            break;
        }
    }
    None
}

/// `Tokenizer#next_tag_token`: an unterminated `{%` is a token of its own.
fn tag_token_end(source: &str, after_open: usize) -> usize {
    crate::find_ascii(&source[after_open..], "%}").map_or(after_open, |i| after_open + i + 2)
}

/// `Tokenizer#next_variable_token`: a `{%` inside an unfinished `{{` extends it to that tag's `%}`.
fn variable_token_end(source: &str, after_open: usize) -> usize {
    let b = source.as_bytes();
    let mut i = after_open;
    loop {
        while i < b.len() && b[i] != b'}' && b[i] != b'{' {
            i += 1;
        }
        if i + 1 >= b.len() {
            return b.len();
        }
        match (b[i], b[i + 1]) {
            (b'}', b'}') => return i + 2,
            (b'}', _) => return i + 1,
            (b'{', b'%') => return tag_token_end(source, i + 2),
            _ => i += 1,
        }
    }
}

/// `findRawBodyEnd`: where the body of `tag_name` that starts at `body_start` ends under `rule`,
/// reading the source as `Liquid::Tokenizer` tokens. `None` where Liquid reports the tag as never
/// closed, or rejects a tag nested inside it.
pub(crate) fn find_raw_body_end(
    source: &str,
    body_start: usize,
    tag_name: &str,
    rule: &RawBodyRule,
) -> Option<RawBodyEnd> {
    let b = source.as_bytes();
    let (mut token_start, mut depth) = (body_start, 1);
    while token_start < b.len() {
        // Text can't name a tag: skip to the next Liquid token.
        let at = |i: usize| b[i] == b'{' && matches!(b.get(i + 1), Some(b'%' | b'{'));
        if !at(token_start) {
            token_start += (token_start..b.len()).position(at)?;
        }
        let token_end = if b[token_start + 1] == b'%' {
            tag_token_end(source, token_start + 2)
        } else {
            variable_token_end(source, token_start + 2)
        };
        let token = &source[token_start..token_end];
        match token_tag(token, rule.leading) {
            Some((name, i)) if name.strip_prefix("end") == Some(tag_name) => {
                depth -= 1;
                if depth == 0 {
                    let tag_start = token_start + i;
                    return Some(RawBodyEnd {
                        tag_start,
                        tag_end: token_end,
                        ws_start: b[tag_start + 2] == b'-',
                        ws_end: token.as_bytes()[token.len() - 3] == b'-',
                    });
                }
            }
            Some((name, _)) if name == tag_name => match rule.same_name {
                SameName::Rejected => return None,
                SameName::Nests => depth += 1,
                SameName::Ignored => {}
            },
            Some((name, _)) if rule.opaque.contains(&name) => {
                let inner = rule_for(name)?;
                token_start = find_raw_body_end(source, token_end, name, inner)?.tag_end;
                continue;
            }
            _ => {}
        }
        token_start = token_end;
    }
    None
}

/// `findRawLineBodyEnd`: the index of the line that ends the body of `tag_name` starting at
/// `lines[from]` inside `{% liquid %}`, where each line is a token named by its leading `#` or
/// word.
pub(crate) fn find_raw_line_body_end(
    source: &str,
    lines: &[LiquidLine],
    from: usize,
    tag_name: &str,
    rule: &RawBodyRule,
) -> Option<usize> {
    if !rule.closes_in_liquid_tag {
        return None;
    }
    let mut depth = 1;
    let mut index = from;
    while index < lines.len() {
        match line_tag_name(source, &lines[index]) {
            Some(name) if name.strip_prefix("end") == Some(tag_name) => {
                depth -= 1;
                if depth == 0 {
                    return Some(index);
                }
            }
            Some(name) if name == tag_name => match rule.same_name {
                SameName::Rejected => return None,
                SameName::Nests => depth += 1,
                SameName::Ignored => {}
            },
            Some(name) if rule.opaque.contains(&name) => {
                let inner = rule_for(name)?;
                index = find_raw_line_body_end(source, lines, index + 1, name, inner)?;
            }
            _ => {}
        }
        index += 1;
    }
    None
}

/// `BlockBody::LiquidTagToken` indents only with ASCII whitespace, so a line indented with a
/// character such as U+00A0 has no name.
fn line_tag_name<'a>(source: &str, line: &LiquidLine<'a>) -> Option<&'a str> {
    let line_start = source[..line.name_offset].rfind('\n').map_or(0, |i| i + 1);
    let indent = &source.as_bytes()[line_start..line.name_offset];
    if !indent
        .iter()
        .all(|c| matches!(c, b' ' | b'\t' | 0x0b | 0x0c | b'\r'))
    {
        return None;
    }
    let name = line.tag_name;
    let n = if name.starts_with('#') {
        1
    } else {
        word_len(name.as_bytes())
    };
    (n > 0).then(|| &name[..n])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_raw_body_ends() {
        fn end<'s>(s: &'s str, name: &str) -> Option<&'s str> {
            find_raw_body_end(s, 0, name, rule_for(name).unwrap())
                .map(|e| &s[e.tag_start..e.tag_end])
        }
        // Comments nest and skip raw bodies.
        let s =
            "{% comment %}{% raw %}{% endcomment %}{% endraw %}{%- endcomment -%}x{% endcomment %}";
        assert_eq!(end(s, "comment"), Some("{% endcomment %}"));
        // Raw closes at the last tag of a token, with extra strings.
        assert_eq!(end("{{ x {% endraw y %}", "raw"), Some("{% endraw y %}"));
        assert_eq!(
            end("{%endrawx%}{%  endraw\t-%}", "raw"),
            Some("{%  endraw\t-%}")
        );
        // Doc rejects a nested doc; an output runs into a tag's `%}`.
        assert_eq!(end("{% doc %}{% enddoc %}", "doc"), None);
        assert_eq!(end("{{ x{% endcomment %}", "comment"), None);
    }
}
