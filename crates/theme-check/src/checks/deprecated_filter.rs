use super::liquid_html_syntax_error::utils::add16;
use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use crate::docset::ThemeDocset;
use crate::fixes::{Fix, Suggestion};
use crate::js;
use crate::json::js_number_to_string;
use liquid_ast::{LiquidFilter, NamedArgument, Node, NodeKind, NodeRef};
use regex::Regex;
use serde_json::Value;
use std::sync::LazyLock;

pub static DEPRECATED_FILTER: CheckDef = CheckDef {
    code: "DeprecatedFilter",
    name: "Deprecated Filter",
    aliases: &["DeprecatedFilters"],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

static REPLACED_BY: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"replaced by \[`([^\n\r\u{2028}\u{2029}]+?)`\]").unwrap());

struct Check<'a> {
    docset: &'a ThemeDocset,
    /// The docset's deprecated filters, in order, so `filters.find(f => f.deprecated && f.name
    /// === name)` scans a handful of entries instead of every filter.
    deprecated: Vec<&'a Value>,
}

fn name_of(f: &Value) -> Option<&str> {
    f.get("name").and_then(Value::as_str)
}

fn create<'a>(cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    let docset = cx.docset()?;
    let deprecated = docset
        .filters
        .iter()
        .filter(|f| f.get("deprecated").is_some_and(js::truthy))
        .collect();
    Some(Box::new(Check { docset, deprecated }))
}

impl<'a> LiquidCheck<'a> for Check<'a> {
    fn node_mask(&self) -> u64 {
        NodeKind::LiquidFilter.bit()
    }

    fn node(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidFilter(f) = node else {
            return Ok(());
        };
        let Some(deprecated) = self
            .deprecated
            .iter()
            .copied()
            .find(|d| name_of(d) == Some(&f.name))
        else {
            return Ok(());
        };
        let deprecated_name = js::opt_to_string(deprecated.get("name"));
        let recommended = deprecated
            .get("deprecation_reason")
            .and_then(Value::as_str)
            .and_then(|reason| REPLACED_BY.captures(reason))
            .and_then(|m| self.docset.filter(m.get(1).unwrap().as_str()));
        let message = match recommended {
            Some(r) => format!(
                "Deprecated filter '{deprecated_name}', consider using '{}'.",
                js::opt_to_string(r.get("name"))
            ),
            None => format!("Deprecated filter '{deprecated_name}'."),
        };
        let source = cx.source();
        let suggest = match &*f.name {
            "img_tag" => Some(suggest_img_tag_fix(f, source)),
            "img_url" => suggest_img_url_fix(f, source),
            filter @ ("article_img_url" | "collection_img_url" | "product_img_url") => {
                Some(suggest_image_url_fix(filter, f, source))
            }
            _ => None,
        };
        let fix = if &*f.name == "hex_to_rgba" {
            fix_hex_to_rgba(f, source)
        } else {
            None
        };
        let start = add16(source, f.position.start, 1);
        cx.report_with(message, start, f.position.end, fix, suggest);
        Ok(())
    }
}

// `fixes.ts`

/// Width and height values cannot exceed this maximum size.
const MAX_SIZE: f64 = 5760.0;

/// ponytail: `size in NAMED_SIZES` also holds for `Object.prototype` keys (`toString`, ...), whose
/// values TS prints as function sources in `img_tag` and `*_img_url` suggestions; here they parse
/// as `NaN`, which is what `img_url` ends up with either way.
const NAMED_SIZES: &[(&str, f64)] = &[
    ("pico", 16.0),
    ("icon", 32.0),
    ("thumb", 50.0),
    ("small", 100.0),
    ("compact", 160.0),
    ("medium", 240.0),
    ("large", 480.0),
    ("grande", 600.0),
    ("original", 1024.0),
];

/// `{ width, height }`, `NaN` for `undefined`.
type ImageSize = (f64, f64);

/// Filter parameters, with values already printed. `None` is a falsy value.
type FilterParameters = Vec<(&'static str, Option<String>)>;

fn fix_hex_to_rgba(f: &LiquidFilter, source: &str) -> Option<Fix> {
    // The `hex_to_rgba` filter is only valid with zero or one argument (`alpha`).
    if f.args.len() > 1 {
        return None;
    }
    let (start, end) = filter_source_start_and_end(f, source);
    let fixed = match expression_argument_value(f, 0).filter(|a| !a.is_empty()) {
        Some(alpha) => format!(" color_to_rgb | color_modify: 'alpha', {alpha}"),
        None => " color_to_rgb".into(),
    };
    Some(Fix::replace(start, end, fixed))
}

fn suggest_img_tag_fix(f: &LiquidFilter, source: &str) -> Vec<Suggestion> {
    let alt = expression_argument_value(f, 0);
    let css_class = expression_argument_value(f, 1);
    let (width, height) = image_size(expression_argument_value(f, 2), (-1.0, -1.0));
    let (start, end) = filter_source_start_and_end(f, source);
    let (url_width, url_height) = ensure_image_value((width, height));
    let image_url = build_filter_string(
        "image_url",
        vec![("width", num(url_width)), ("height", num(url_height))],
    );
    let image_tag = build_filter_string(
        "image_tag",
        vec![
            ("width", num(width)),
            ("height", num(height)),
            ("alt", str_value(alt)),
            ("class", str_value(css_class)),
        ],
    );
    vec![Suggestion::new(
        "Replace 'img_tag' with 'image_tag'.",
        Fix::replace(start, end, format!("{image_url} |{image_tag}")),
    )]
}

fn suggest_img_url_fix(f: &LiquidFilter, source: &str) -> Option<Vec<Suggestion>> {
    let crop = named_argument_node(f, "crop");
    let format = named_argument_node(f, "format");
    let scale = named_argument_node(f, "scale");
    // Cannot fix when 'scale' or 'size' node are variable lookups.
    if scale.is_some_and(|s| matches!(*s.value, Node::VariableLookup(_)))
        || matches!(f.args.first(), Some(Node::VariableLookup(_)))
    {
        return None;
    }
    let (width, height) = ensure_image_value(scale_image(
        f,
        image_size(expression_argument_value(f, 0), (100.0, 100.0)),
    ));
    let (start, end) = filter_source_start_and_end(f, source);
    let mut parameters: FilterParameters = vec![("width", num(width)), ("height", num(height))];
    if let Some(Node::String(s)) = crop.map(|c| &*c.value) {
        parameters.push(("crop", str_value(Some(&s.value))));
    }
    match format.map(|c| &*c.value) {
        Some(Node::String(s)) => parameters.push(("format", str_value(Some(&s.value)))),
        Some(Node::VariableLookup(v)) => parameters.push((
            "format",
            v.name
                .as_ref()
                .filter(|n| !n.is_empty())
                .map(|n| n.to_string()),
        )),
        _ => {}
    }
    let fix = Fix::replace(start, end, build_filter_string("image_url", parameters));
    Some(vec![Suggestion::new(
        "Replace 'img_url' with 'image_url'.",
        fix,
    )])
}

fn suggest_image_url_fix(filter: &str, f: &LiquidFilter, source: &str) -> Vec<Suggestion> {
    let (width, height) =
        ensure_image_value(image_size(expression_argument_value(f, 0), (100.0, 100.0)));
    let (start, end) = filter_source_start_and_end(f, source);
    let fix = Fix::replace(
        start,
        end,
        build_filter_string(
            "image_url",
            vec![("width", num(width)), ("height", num(height))],
        ),
    );
    vec![Suggestion::new(
        format!("Replace '{filter}' with 'image_url'."),
        fix,
    )]
}

/// `getImageSize(size, imageSize)`
fn image_size(size: Option<&str>, default: ImageSize) -> ImageSize {
    let Some(size) = size.filter(|s| !s.is_empty()) else {
        return default;
    };
    if let Some(&(_, s)) = NAMED_SIZES.iter().find(|(n, _)| *n == size) {
        return (s, s);
    }
    let mut parts = size.split('x').map(parse_int);
    ensure_image_size_limit((
        parts.next().unwrap_or(f64::NAN),
        parts.next().unwrap_or(f64::NAN),
    ))
}

/// `scaleImage(node, imageSize)`
fn scale_image(f: &LiquidFilter, (width, height): ImageSize) -> ImageSize {
    let scale = parse_int(
        named_argument_value(f, "scale")
            .filter(|s| !s.is_empty())
            .unwrap_or("0"),
    );
    let scale = if truthy(scale) { scale } else { 1.0 };
    ensure_image_size_limit((width * scale, height * scale))
}

/// `Math.min(n, MAX_SIZE)`
fn js_min(n: f64) -> f64 {
    if n.is_nan() {
        n
    } else {
        n.min(MAX_SIZE)
    }
}

fn ensure_image_size_limit((width, height): ImageSize) -> ImageSize {
    (js_min(width), js_min(height))
}

/// `ensureImageValue`: `image_url` without a width or height defaults to width=100, as the
/// documentation says it errors when neither is given.
fn ensure_image_value((width, height): ImageSize) -> ImageSize {
    let unset = |n: f64| !truthy(n) || n == -1.0;
    if unset(height) && unset(width) {
        (100.0, height)
    } else {
        (width, height)
    }
}

fn truthy(n: f64) -> bool {
    n != 0.0 && !n.is_nan()
}

/// A number parameter, `None` where `buildFilterString` drops it (`value && value !== -1`).
fn num(n: f64) -> Option<String> {
    (truthy(n) && n != -1.0).then(|| js_number_to_string(n))
}

/// `strValue(value)`
fn str_value(value: Option<&str>) -> Option<String> {
    value.filter(|v| !v.is_empty()).map(|v| format!("'{v}'"))
}

/// `getExpressionArgumentValue(node, index)`: positional over every argument, named ones included.
fn expression_argument_value<'f>(f: &'f LiquidFilter, index: usize) -> Option<&'f str> {
    match f.args.get(index)? {
        Node::Number(n) => Some(&n.value),
        Node::String(s) => Some(&s.value),
        _ => None,
    }
}

fn named_argument_node<'f, 'a>(
    f: &'f LiquidFilter<'a>,
    name: &str,
) -> Option<&'f NamedArgument<'a>> {
    f.args.iter().find_map(|a| match a {
        Node::NamedArgument(a) if a.name == name => Some(a),
        _ => None,
    })
}

fn named_argument_value<'f>(f: &'f LiquidFilter, name: &str) -> Option<&'f str> {
    match &*named_argument_node(f, name)?.value {
        Node::Number(n) => Some(&n.value),
        Node::String(s) => Some(&s.value),
        _ => None,
    }
}

fn build_filter_string(filter: &str, parameters: FilterParameters) -> String {
    let parameters: Vec<String> = parameters
        .into_iter()
        .filter_map(|(k, v)| Some(format!("{k}: {}", v?)))
        .collect();
    if parameters.is_empty() {
        format!(" {filter}")
    } else {
        format!(" {filter}: {}", parameters.join(", "))
    }
}

/// `getFilterSourceStartAndEnd`: from after the filter's `|`.
fn filter_source_start_and_end(f: &LiquidFilter, source: &str) -> (usize, usize) {
    let start = f.position.start;
    (
        source[start..].find('|').map_or(start, |i| start + i + 1),
        f.position.end,
    )
}

/// `parseInt(s)`. ponytail: hex digits past 2^53 accumulate rounding error; V8 rounds once.
fn parse_int(s: &str) -> f64 {
    let s = js::trim_start(s);
    let (neg, s) = match s.strip_prefix('-') {
        Some(rest) => (true, rest),
        None => (false, s.strip_prefix('+').unwrap_or(s)),
    };
    let (radix, s) = match s.get(..2) {
        Some("0x" | "0X") => (16, &s[2..]),
        _ => (10, s),
    };
    let digits = &s[..s.find(|c: char| !c.is_digit(radix)).unwrap_or(s.len())];
    if digits.is_empty() {
        return f64::NAN;
    }
    let n = if radix == 10 {
        digits.parse().unwrap()
    } else {
        digits
            .chars()
            .fold(0.0, |n, c| n * 16.0 + c.to_digit(16).unwrap() as f64)
    };
    if neg {
        -n
    } else {
        n
    }
}

#[cfg(test)]
mod tests {
    use super::parse_int;

    #[test]
    fn parse_int_like_js() {
        assert_eq!(parse_int(" 100x"), 100.0);
        assert_eq!(parse_int("-0x1F"), -31.0);
        assert_eq!(parse_int("+7.5"), 7.0);
        assert!(parse_int("").is_nan() && parse_int("0x").is_nan() && parse_int("x5").is_nan());
    }
}
