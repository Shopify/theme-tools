//! `liquid-doc/arguments.ts`, the argument parts of `liquid-doc/utils.ts` and `tags/content-for.ts`,
//! shared by the render, content_for and block argument checks.

use crate::context::Context;
use crate::docset::ThemeDocset;
use crate::fixes::{Fix, Suggestion};
use crate::js;
use crate::liquid_doc::{
    normalize_named_param_type, parse_param_type_syntax, parse_string_literals, LiquidDocParameter,
};
use liquid_ast::{ContentForMarkup, NamedArgument, Node, Position, RenderMarkup};
use serde_json::Value;

pub const RESERVED_CONTENT_FOR_ARGUMENTS: &[&str] = &[
    "attributes",
    "block",
    "blocks",
    "class",
    "context",
    "inherit",
    "resource",
    "resources",
    "schema",
    "section",
    "sections",
    "settings",
    "snippet",
    "snippets",
    "src",
    "style",
    "styles",
    "template",
    "templates",
];
pub const REQUIRED_CONTENT_FOR_ARGUMENTS: &[&str] = &["id", "type"];
pub const CLOSEST_ARGUMENT: &str = "closest.";

/// `BasicParamTypes`
const BASIC_PARAM_TYPES: &[&str] = &["string", "number", "boolean", "object"];

/// The tag whose arguments are reported (TS checks `node.type`).
#[derive(Clone, Copy)]
pub enum ArgsTag {
    Render,
    ContentFor,
}

impl ArgsTag {
    /// `errorOwnerMessage`
    fn owner(self, name: &str) -> String {
        match self {
            ArgsTag::Render => format!(" in render tag for snippet '{name}'"),
            ArgsTag::ContentFor => format!(" in content_for tag for static block '{name}'"),
        }
    }
}

/// `new Map(parameters.map((p) => [p.name, p]))`, without building it: a name keeps the slot of
/// its first occurrence and the value of its last. ponytail: linear lookups, a snippet or block has
/// a handful of params; index them if that stops being true.
#[derive(Clone, Copy)]
pub struct DocParams<'a>(&'a [LiquidDocParameter]);

impl<'a> DocParams<'a> {
    pub fn get(&self, name: &str) -> Option<&'a LiquidDocParameter> {
        self.0.iter().rev().find(|p| p.name == name)
    }
    pub fn has(&self, name: &str) -> bool {
        self.0.iter().any(|p| p.name == name)
    }
    /// `map.values()`
    pub fn values(self) -> impl Iterator<Item = &'a LiquidDocParameter> {
        let all = self.0;
        all.iter()
            .enumerate()
            .filter(move |(i, p)| !all[..*i].iter().any(|q| q.name == p.name))
            .filter_map(move |(_, p)| self.get(&p.name))
    }
}

/// `getLiquidDocParams(context, relativePath)`
pub fn get_liquid_doc_params<'a>(cx: &Context<'a>, relative_path: &str) -> Option<DocParams<'a>> {
    let params = &cx
        .get_doc_definition(relative_path)?
        .liquid_doc
        .as_ref()?
        .parameters;
    // `liquidDoc.parameters` is only set when there are some.
    (!params.is_empty()).then_some(DocParams(params))
}

/// `getSnippetName(node)`, `None` when falsy (every caller returns early on `''`).
pub fn get_snippet_name<'a>(node: &'a RenderMarkup<'a>) -> Option<&'a str> {
    match node.snippet.as_ref() {
        Node::String(s) if !s.value.is_empty() => Some(&s.value),
        _ => None,
    }
}

/// `getBlockName(node)`, `None` when falsy (every caller returns early on `''`).
pub fn get_block_name<'a>(node: &'a ContentForMarkup<'a>) -> Option<&'a str> {
    if node.content_for_type.value != "block" {
        return None;
    }
    match node.args.iter().find(|a| a.name == "type")?.value.as_ref() {
        Node::String(s) if !s.value.is_empty() => Some(&s.value),
        _ => None,
    }
}

/// `reportUnknownArguments`. `pos` and `node_args` are the tag markup's.
pub fn report_unknown_arguments<'a>(
    cx: &mut Context,
    tag: ArgsTag,
    pos: Position,
    node_args: &[NamedArgument],
    args: impl IntoIterator<Item = &'a NamedArgument<'a>>,
    name: &str,
) {
    for arg in args {
        let suggest = vec![Suggestion::new(
            format!("Remove '{}'", arg.name),
            remove_argument_fix(cx.source(), pos, node_args, arg),
        )];
        let message = format!("Unknown argument '{}'{}.", arg.name, tag.owner(name));
        cx.report_with(
            message,
            arg.position.start,
            arg.position.end,
            None,
            Some(suggest),
        );
    }
}

/// `reportMissingArguments`: at the tag markup's position.
pub fn report_missing_arguments<'a>(
    cx: &mut Context,
    tag: ArgsTag,
    position: Position,
    node_args: &[NamedArgument],
    params: impl IntoIterator<Item = &'a LiquidDocParameter>,
    name: &str,
) {
    for p in params {
        let suggest = vec![Suggestion::new(
            format!("Add required argument '{}'", p.name),
            add_argument_fix(cx.source(), position, node_args, p),
        )];
        let message = format!("Missing required argument '{}'{}.", p.name, tag.owner(name));
        cx.report_with(message, position.start, position.end, None, Some(suggest));
    }
}

/// `reportDuplicateArguments` over the `encounteredArgNames` scan. `seen` seeds the set (the
/// render alias). ponytail: scans the earlier args instead of a set, tags have a handful of args.
pub fn report_duplicate_arguments(
    cx: &mut Context,
    tag: ArgsTag,
    pos: Position,
    seen: Option<&str>,
    args: &[NamedArgument],
    name: &str,
) {
    for (i, arg) in args.iter().enumerate() {
        if seen == Some(&*arg.name) || args[..i].iter().any(|a| a.name == arg.name) {
            let fix = remove_argument_fix(cx.source(), pos, args, arg);
            let suggest = vec![Suggestion::new(
                format!("Remove duplicate argument '{}'", arg.name),
                fix,
            )];
            let message = format!("Duplicate argument '{}'{}.", arg.name, tag.owner(name));
            cx.report_with(
                message,
                arg.position.start,
                arg.position.end,
                None,
                Some(suggest),
            );
        }
    }
}

/// `findTypeMismatchParams` + `reportTypeMismatches`.
pub fn report_type_mismatches(cx: &mut Context, params: DocParams, args: &[NamedArgument]) {
    for arg in args {
        let Some(ty) = params
            .get(&arg.name)
            .and_then(|p| p.type_.as_deref())
            .filter(|t| !t.is_empty())
        else {
            continue;
        };
        if check_argument_type(ty, &arg.value) == ArgumentTypeCheck::Incompatible {
            let p = arg.value.position();
            let message =
                get_argument_type_mismatch_message(&arg.name, ty, &arg.value, cx.source());
            cx.report_with(
                message,
                p.start,
                p.end,
                None,
                Some(generate_type_mismatch_suggestions(ty, p.start, p.end)),
            );
        }
    }
}

/// `generateTypeMismatchSuggestions(expectedType, start, end)`
pub fn generate_type_mismatch_suggestions(
    expected: &str,
    start: usize,
    end: usize,
) -> Vec<Suggestion> {
    if let Some(literals) = parse_string_literals(expected) {
        return literals
            .iter()
            .map(|l| {
                Suggestion::new(
                    format!("Replace with {}", l.raw),
                    Fix::replace(start, end, l.raw),
                )
            })
            .collect();
    }
    let expected = expected.to_lowercase();
    let default = get_default_value_for_type(Some(&expected));
    let mut out = Vec::new();
    if !default.is_empty() {
        out.push(Suggestion::new(
            format!("Replace with default value '{default}' for {expected}"),
            Fix::replace(start, end, default),
        ));
    }
    out.push(Suggestion::new("Remove value", Fix::remove(start, end)));
    out
}

/// `getDefaultValueForType(type)`
pub fn get_default_value_for_type(ty: Option<&str>) -> &str {
    if let Some(l) = ty.and_then(parse_string_literals) {
        return l[0].raw;
    }
    match ty.map(str::to_lowercase).as_deref() {
        Some("string") => "''",
        Some("number") => "0",
        Some("boolean") => "false",
        _ => "",
    }
}

/// `/,\s*$/` matched against `s`: the match length.
fn trailing_comma_len(s: &str) -> Option<usize> {
    let t = js::trim_end(s);
    t.ends_with(',').then(|| s.len() - t.len() + 1)
}

/// `/\s*,\s*/` matched at the start of `s` (`anchored`) or at its first comma: the lengths of the
/// match and of its `\s*,` part.
fn comma_match(s: &str, anchored: bool) -> Option<(usize, usize)> {
    let start = if anchored {
        0
    } else {
        let c = s.find(',')?;
        js::trim_end(&s[..c]).len()
    };
    let rest = js::trim_start(&s[start..]).strip_prefix(',')?;
    let head = s.len() - start - rest.len();
    Some((head + rest.len() - js::trim_start(rest).len(), head))
}

/// `makeRemoveArgumentCorrector(node, arg)`, over the markup at `pos` with `args`.
fn remove_argument_fix(
    source: &str,
    pos: Position,
    args: &[NamedArgument],
    arg: &NamedArgument,
) -> Fix {
    let (start, end) = (arg.position.start, arg.position.end);
    let leading = || trailing_comma_len(&source[pos.start..start]).map_or(start, |n| start - n);
    match comma_match(&source[end..pos.end], true) {
        Some((all, head)) => {
            let is_last = args.len() == 1 || args.last().is_some_and(|a| a.position.start == start);
            if is_last {
                Fix::remove(leading(), end + head)
            } else {
                Fix::remove(start, end + all)
            }
        }
        None => Fix::remove(leading(), end),
    }
}

/// `makeAddArgumentCorrector(node, arg)`, over the markup at `pos` with `args`.
fn add_argument_fix(
    source: &str,
    pos: Position,
    args: &[NamedArgument],
    param: &LiquidDocParameter,
) -> Fix {
    let add = format!(
        ", {}: {}",
        param.name,
        get_default_value_for_type(param.type_.as_deref())
    );
    let Some(last) = args.last() else {
        // `node.position.end - 1`. ponytail: lands before the last char, where TS splits an astral one.
        let at = source[..pos.end]
            .char_indices()
            .next_back()
            .map_or(pos.end, |(i, _)| i);
        return Fix::insert(at, add);
    };
    let end = last.position.end;
    match comma_match(&source[end..pos.end], false) {
        Some((all, _)) => Fix::replace(end, end + all, format!("{add} ")),
        None => Fix::insert(end, add),
    }
}

/// TS `ArgumentTypeCheck` (`named-type` drops its `type`, which no caller reads).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ArgumentTypeCheck {
    Compatible,
    Incompatible,
    Unchecked,
    NamedType,
}

fn literal_check(matches: bool) -> ArgumentTypeCheck {
    if matches {
        ArgumentTypeCheck::Compatible
    } else {
        ArgumentTypeCheck::Incompatible
    }
}

/// `inferArgumentType(arg)`. Arguments are only ever these expression types (TS `assertNever`
/// guards the rest), so anything else counts as `object`.
pub fn infer_argument_type(arg: &Node) -> &'static str {
    match arg {
        Node::String(_) => "string",
        Node::Number(_) => "number",
        Node::LiquidLiteral(_) => "boolean",
        _ => "object",
    }
}

/// `isTypeCompatible(expectedType, actualType)`. ASCII case folding is exact here: the only
/// non-ASCII char that lowercases into ASCII is the Kelvin sign, and no basic type has a `k`.
pub fn is_type_compatible(expected: &str, actual: &str) -> bool {
    expected.eq_ignore_ascii_case("boolean") || expected.eq_ignore_ascii_case(actual)
}

/// `checkArgumentType(expectedType, argument)`
pub fn check_argument_type(expected: &str, arg: &Node) -> ArgumentTypeCheck {
    if matches!(arg, Node::VariableLookup(_)) {
        return ArgumentTypeCheck::Unchecked;
    }
    if let Some(literals) = parse_string_literals(expected) {
        return literal_check(
            matches!(arg, Node::String(s) if literals.iter().any(|l| l.value == s.value)),
        );
    }
    if matches!(arg, Node::BlockArrayLiteral(_)) {
        return ArgumentTypeCheck::Unchecked;
    }
    let Some(ty) = normalize_named_param_type(expected) else {
        return ArgumentTypeCheck::Unchecked;
    };
    if !BASIC_PARAM_TYPES.contains(&ty.as_str()) {
        return ArgumentTypeCheck::NamedType;
    }
    literal_check(is_type_compatible(&ty, infer_argument_type(arg)))
}

/// `getArgumentTypeMismatchMessage(name, expectedType, argument)`
pub fn get_argument_type_mismatch_message(
    name: &str,
    expected: &str,
    arg: &Node,
    source: &str,
) -> String {
    if parse_string_literals(expected).is_some() {
        let p = arg.position();
        return format!(
            "Invalid value for argument '{name}': expected {}, got {}",
            js::trim(expected),
            &source[p.start..p.end]
        );
    }
    let actual = if matches!(arg, Node::BlockArrayLiteral(_)) {
        "array"
    } else {
        infer_argument_type(arg)
    };
    format!(
        "Type mismatch for argument '{name}': expected {}, got {actual}",
        expected.to_lowercase()
    )
}

/// `getValidParamTypes(liquidDrops).has(name)`
fn is_valid_param_type(docset: &ThemeDocset, name: &str) -> bool {
    BASIC_PARAM_TYPES.contains(&name)
        || docset
            .liquid_drops
            .iter()
            .any(|o| o.get("name").and_then(Value::as_str) == Some(name))
}

/// `parseParamType(validParamTypes, value) !== undefined`
pub fn is_supported_named_param_type(docset: &ThemeDocset, value: &str) -> bool {
    parse_param_type_syntax(value).is_some_and(|(base, _)| is_valid_param_type(docset, base))
}
