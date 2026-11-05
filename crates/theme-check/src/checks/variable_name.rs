use crate::context::{CheckDef, CheckError, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::fixes::{Fix, Suggestion};
use liquid_ast::{Markup, Node, NodeKind, NodeRef, Position};
use regex::Regex;
use std::sync::LazyLock;

pub static VARIABLE_NAME: CheckDef = CheckDef {
    code: "VariableName",
    name: "Invalid variable naming format",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[("format", "\"snake_case\"")],
    create: Create::Liquid(create),
};

#[derive(Clone, Copy)]
enum Format {
    Camel,
    Pascal,
    Snake,
    Kebab,
}

/// `Err` holds the unknown `format`: TS throws when it calls `formatTypes[format]`.
struct Check<'a> {
    format: Result<Format, &'a str>,
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let format = match cx.setting_str("format").unwrap_or("snake_case") {
        "camelCase" => Ok(Format::Camel),
        "PascalCase" => Ok(Format::Pascal),
        "snake_case" => Ok(Format::Snake),
        "kebab-case" => Ok(Format::Kebab),
        other => Err(other),
    };
    Some(Box::new(Check { format }))
}

/// lodash `reHasUnicodeWord`
static HAS_UNICODE_WORD: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"[a-z][A-Z]|[A-Z]{2}[a-z]|[0-9][a-zA-Z]|[a-zA-Z][0-9]|[^a-zA-Z0-9 ]").unwrap()
});
/// `collapseNumberSpacing`
static NUMBER_SPACING: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"[-_]?[0-9][-_]?").unwrap());

/// lodash `words(string)` for ASCII strings (Liquid identifiers are ASCII, and `deburr` and the
/// apostrophe removal are no-ops on them).
fn words(s: &str) -> Vec<&str> {
    let b = s.as_bytes();
    if !HAS_UNICODE_WORD.is_match(s) {
        // asciiWords
        return s
            .split(|c: char| !c.is_ascii_alphanumeric())
            .filter(|w| !w.is_empty())
            .collect();
    }
    // unicodeWords: the ASCII parts of `reUnicodeWord`, where `rsBreak` is any other ASCII char
    // and the `rsMisc*` and contraction parts match nothing.
    let n = b.len();
    let up = |i: usize| i < n && b[i].is_ascii_uppercase();
    let lo = |i: usize| i < n && b[i].is_ascii_lowercase();
    let dg = |i: usize| i < n && b[i].is_ascii_digit();
    let brk = |i: usize| i < n && !b[i].is_ascii_alphanumeric();
    let run = |mut i: usize, f: &dyn Fn(usize) -> bool| {
        while f(i) {
            i += 1;
        }
        i
    };
    // `\d*(?:1ST|2ND|3RD|(?![123])\dTH)`, then `ok(end)` for the lookahead.
    let ordinal = |i: usize, sfx: [&[u8]; 4], ok: &dyn Fn(usize) -> bool| {
        (i..run(i, &dg)).rev().find_map(|m| {
            let tail = &b[m..];
            let e = m + 3;
            let hit = [sfx[0], sfx[1], sfx[2]].iter().any(|x| tail.starts_with(x))
                || (tail.len() >= 3
                    && !matches!(tail[0], b'1'..=b'3')
                    && tail[1..].starts_with(sfx[3]));
            (hit && ok(e)).then_some(e)
        })
    };
    let mut out = Vec::new();
    let mut i = 0;
    while i < n {
        let j = i + up(i) as usize;
        let lower_end = run(j, &lo);
        let upper_end = run(i, &up);
        let end = None
            // [A-Z]?[a-z]+(?=break|[A-Z]|$)
            .or_else(|| {
                (lower_end > j && (lower_end == n || brk(lower_end) || up(lower_end)))
                    .then_some(lower_end)
            })
            // [A-Z]+(?=break|[A-Z][a-z]|$)
            .or_else(|| {
                (i + 1..=upper_end)
                    .rev()
                    .find(|&k| k == n || brk(k) || (up(k) && lo(k + 1)))
                    .filter(|_| upper_end > i)
            })
            // [A-Z]?[a-z]+
            .or_else(|| (lower_end > j).then_some(lower_end))
            // [A-Z]+
            .or_else(|| (upper_end > i).then_some(upper_end))
            // rsOrdUpper: (?=\b|[a-z_])
            .or_else(|| ordinal(i, [b"1ST", b"2ND", b"3RD", b"TH"], &|e| !(up(e) || dg(e))))
            // rsOrdLower: (?=\b|[A-Z_])
            .or_else(|| ordinal(i, [b"1st", b"2nd", b"3rd", b"th"], &|e| !(lo(e) || dg(e))))
            // \d+
            .or_else(|| Some(run(i, &dg)).filter(|&e| e > i));
        match end {
            Some(e) => {
                out.push(&s[i..e]);
                i = e;
            }
            None => i += 1,
        }
    }
    out
}

/// lodash `camelCase` / `snakeCase` / `kebabCase`, and the check's `pascalCase`.
fn format_name(format: Format, s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 4);
    for (i, w) in words(s).into_iter().enumerate() {
        match format {
            Format::Camel | Format::Pascal => {
                let mut chars = w.chars();
                if let Some(first) = chars
                    .next()
                    .filter(|_| i > 0 || matches!(format, Format::Pascal))
                {
                    out.push(first.to_ascii_uppercase());
                    out.extend(chars.map(|c| c.to_ascii_lowercase()));
                } else {
                    out.push_str(&w.to_ascii_lowercase());
                }
            }
            Format::Snake | Format::Kebab => {
                if i > 0 {
                    out.push(if matches!(format, Format::Snake) {
                        '_'
                    } else {
                        '-'
                    });
                }
                out.push_str(&w.to_ascii_lowercase());
            }
        }
    }
    out
}

impl Check<'_> {
    /// `formatter(node)`: `valid`, and `suggestion` (`None` is `undefined`).
    fn formatter(&self, name: &str) -> Result<(bool, Option<String>), CheckError> {
        if name.is_empty() {
            return Ok((false, None));
        }
        let format = self
            .format
            .map_err(|f| CheckError::new(format!("formatTypes['{f}'] is not a function")))?;
        let leading_underscore = if name.starts_with('_') { "_" } else { "" };
        let rest = &name[leading_underscore.len()..];
        let suggestion = format!("{leading_underscore}{}", format_name(format, rest));
        let valid = !rest.is_empty()
            && NUMBER_SPACING.replace_all(name, "") == NUMBER_SPACING.replace_all(&suggestion, "");
        Ok((valid, Some(suggestion)))
    }
}

/// The variable name and markup position of an assign, or of a capture with a name.
fn variable<'a>(tag: &'a liquid_ast::LiquidTag<'a>) -> Option<(&'a str, Position)> {
    let Markup::Node(markup) = &tag.markup else {
        return None;
    };
    match (&*tag.name, markup.as_ref()) {
        ("assign", Node::AssignMarkup(a)) => Some((&a.name, a.position)),
        ("capture", Node::VariableLookup(v)) => {
            Some((v.name.as_deref().filter(|n| !n.is_empty())?, v.position))
        }
        _ => None,
    }
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidTag.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidTag(tag) = node else {
            return Ok(());
        };
        let Some((name, p)) = variable(tag) else {
            return Ok(());
        };
        let (valid, suggestion) = self.formatter(name)?;
        if !valid {
            // `${undefined}`, and `.replace(name, undefined)` inserts "undefined".
            let suggestion = suggestion.as_deref().unwrap_or("undefined");
            let fixed = cx.source()[p.start..p.end].replacen(name, suggestion, 1);
            let message = format!("Change variable '{name}' to '{suggestion}'");
            let suggest = vec![Suggestion::new(
                message,
                Fix::replace(p.start, p.end, fixed),
            )];
            cx.report_with(
                format!("The variable '{name}' uses wrong naming format"),
                p.start,
                p.end,
                None,
                Some(suggest),
            );
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lodash_words() {
        assert_eq!(words("fooBar_baz-qux"), ["foo", "Bar", "baz", "qux"]);
        assert_eq!(words("XMLHttpRequest"), ["XML", "Http", "Request"]);
        assert_eq!(words("foo1bar"), ["foo", "1", "bar"]);
        assert_eq!(words("var_1st"), ["var", "1st"]);
        assert_eq!(words("21ST_floor"), ["21ST", "floor"]);
        assert_eq!(words("a12b"), ["a", "12", "b"]);
        assert_eq!(words("plain"), ["plain"]);
        assert_eq!(format_name(Format::Camel, "foo_bar"), "fooBar");
        assert_eq!(format_name(Format::Pascal, "foo_bar"), "FooBar");
        assert_eq!(format_name(Format::Snake, "fooBar"), "foo_bar");
        assert_eq!(format_name(Format::Kebab, "fooBar"), "foo-bar");
    }
}
