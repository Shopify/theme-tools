use crate::context::{CheckDef, CheckResult, Context, Create, LiquidCheck, Severity};
use liquid_ast::{LiquidFilter, NamedArgument, Node, NodeKind, NodeRef};

pub static VALID_IMAGE_TAG_WIDTHS: CheckDef = CheckDef {
    code: "ValidImageTagWidths",
    name: "Valid image_tag widths",
    aliases: &[],
    severity: Severity::Warning,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create),
};

struct Check;

fn create<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

fn named_argument<'f, 'a>(f: &'f LiquidFilter<'a>, name: &str) -> Option<&'f NamedArgument<'a>> {
    f.args.iter().find_map(|arg| match arg {
        Node::NamedArgument(a) if &*a.name == name => Some(a),
        _ => None,
    })
}

/// The `width:` of an `image_url` filter, when it's a number literal.
fn image_url_width(f: &LiquidFilter) -> Option<f64> {
    match &*named_argument(f, "width")?.value {
        Node::Number(n) => n.value.parse::<f64>().ok().filter(|w| w.is_finite()),
        _ => None,
    }
}

fn is_width(s: &str) -> bool {
    let mut parts = s.splitn(2, '.');
    let digits = |p: &str| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit());
    parts.next().is_some_and(digits) && parts.next().is_none_or(digits)
}

/// The largest number in the `widths:` string of an `image_tag` filter.
fn largest_image_tag_width(widths: &NamedArgument) -> Option<f64> {
    let Node::String(s) = &*widths.value else {
        return None;
    };
    s.value
        .split(',')
        .map(str::trim)
        .filter(|w| is_width(w))
        .filter_map(|w| w.parse::<f64>().ok())
        .reduce(f64::max)
}

/// `${n}` for a JS number.
fn js_number(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e21 {
        format!("{}", n as i64)
    } else {
        format!("{n}")
    }
}

impl<'a> LiquidCheck<'a> for Check {
    fn kinds(&self) -> &'static [NodeKind] {
        &[NodeKind::LiquidVariable]
    }

    fn enter(&mut self, node: NodeRef<'a>, _: &[NodeRef<'a>], cx: &mut Context<'a>) -> CheckResult {
        let NodeRef::LiquidVariable(v) = node else {
            return Ok(());
        };
        let mut url_width: Option<f64> = None;
        for f in &v.filters {
            if &*f.name == "image_url" {
                url_width = image_url_width(f);
                continue;
            }
            if &*f.name != "image_tag" {
                continue;
            }
            let Some(url_width) = url_width else {
                continue;
            };
            let Some(widths) = named_argument(f, "widths") else {
                continue;
            };
            let Some(largest) = largest_image_tag_width(widths) else {
                continue;
            };
            if largest <= url_width {
                continue;
            }
            let (largest, url_width) = (js_number(largest), js_number(url_width));
            cx.report(
                format!(
                    "The image_tag widths go up to {largest}, but the image_url width is {url_width}. \
                     image_tag can't serve images wider than {url_width}px, so raise the image_url width to at least {largest}."
                ),
                widths.span,
            );
        }
        Ok(())
    }
}
