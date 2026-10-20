use crate::context::{CheckDef, CheckResult, Context, Create, JsonCheck, LiquidCheck, Severity};
use crate::json::js_number_to_string;
use regex::Regex;
use std::sync::LazyLock;

pub static MAX_FILE_SIZE: CheckDef = CheckDef {
    code: "MaxFileSize",
    name: "MaxFileSize",
    aliases: &[],
    severity: Severity::Error,
    recommended: true,
    deprecated: false,
    schema: &[],
    create: Create::Liquid(create_liquid),
};

/// `MaxFileSizeJSON`: the same check (and code) for JSON files.
pub static MAX_FILE_SIZE_JSON: CheckDef = CheckDef {
    create: Create::Json(create_json),
    ..MAX_FILE_SIZE
};

const KILOBYTE: f64 = 1024.0;
const MEGABYTE: f64 = 1024.0 * KILOBYTE;
const DRAFTS_DIRECTORY: &str = "_drafts";

#[derive(Clone, Copy, PartialEq)]
enum Measurement {
    FullFileBytes,
    SchemalessBytes,
}

use Measurement::*;

/// `MAX_FILE_SIZE_LIMITS`, in key order.
const MAX_FILE_SIZE_LIMITS: &[(&str, f64, Measurement)] = &[
    ("assets", 20.0 * MEGABYTE, FullFileBytes),
    ("locales", 1.5 * MEGABYTE, SchemalessBytes),
    ("config/settings_data.json", 1.5 * MEGABYTE, SchemalessBytes),
    (
        "config/settings_schema.json",
        512.0 * KILOBYTE,
        SchemalessBytes,
    ),
    ("templates/*.json", 512.0 * KILOBYTE, SchemalessBytes),
    ("sections/*.json", 512.0 * KILOBYTE, SchemalessBytes),
    ("blocks", 256.0 * KILOBYTE, SchemalessBytes),
    ("config", 256.0 * KILOBYTE, SchemalessBytes),
    ("layout", 256.0 * KILOBYTE, SchemalessBytes),
    ("snippets", 256.0 * KILOBYTE, SchemalessBytes),
    ("templates", 256.0 * KILOBYTE, SchemalessBytes),
    ("sections", 256.0 * KILOBYTE, SchemalessBytes),
];

/// `/{%-?\s*schema\s*-?%}[\s\S]*?{%-?\s*endschema\s*-?%}/g`, with JS `\s`.
static SCHEMA_BLOCK_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    let s = r"[[\s\x{FEFF}]--\x{85}]";
    Regex::new(&format!(
        r"\{{%-?{s}*schema{s}*-?%\}}(?s:.)*?\{{%-?{s}*endschema{s}*-?%\}}"
    ))
    .unwrap()
});

struct Check;

fn create_liquid<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn LiquidCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

fn create_json<'a>(_cx: &mut Context<'a>) -> Option<Box<dyn JsonCheck<'a> + 'a>> {
    Some(Box::new(Check))
}

impl<'a> LiquidCheck<'a> for Check {
    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        on_code_path_start(cx)
    }
}

impl<'a> JsonCheck<'a> for Check {
    fn on_code_path_start(&mut self, cx: &mut Context<'a>) -> CheckResult {
        on_code_path_start(cx)
    }
}

fn on_code_path_start(cx: &mut Context) -> CheckResult {
    let Some((bytes, measurement)) = max_file_size_limit(&cx.to_relative_path(cx.uri())) else {
        return Ok(());
    };
    let source = cx.source();
    let measured = match measurement {
        FullFileBytes => source.len(),
        SchemalessBytes => {
            source.len()
                - SCHEMA_BLOCK_REGEX
                    .find_iter(source)
                    .map(|m| m.len())
                    .sum::<usize>()
        }
    } as f64;
    if measured <= bytes {
        return Ok(());
    }
    cx.report(
        format!(
            "Theme file is too large. It is {} but the limit is {}.",
            format_bytes(measured),
            format_bytes(bytes)
        ),
        0,
        source.len(),
    );
    Ok(())
}

fn max_file_size_limit(relative_path: &str) -> Option<(f64, Measurement)> {
    if relative_path == DRAFTS_DIRECTORY || relative_path.starts_with("_drafts/") {
        return None;
    }
    let &(_, bytes, measurement) =
        MAX_FILE_SIZE_LIMITS
            .iter()
            .find(|(key, ..)| match key.split_once('*') {
                Some((prefix, extension)) => {
                    matches_theme_path_prefix(relative_path, prefix)
                        && ends_with_ignore_ascii_case(relative_path, extension)
                }
                None => matches_theme_path(relative_path, key),
            })?;
    Some((bytes, measurement))
}

/// `relativePath.toLowerCase().endsWith(extension)` for `.json` (no non-ASCII character
/// lowercases into it).
fn ends_with_ignore_ascii_case(s: &str, extension: &str) -> bool {
    s.len() >= extension.len()
        && s.as_bytes()[s.len() - extension.len()..].eq_ignore_ascii_case(extension.as_bytes())
}

fn matches_theme_path(relative_path: &str, theme_path: &str) -> bool {
    relative_path == theme_path
        || relative_path
            .strip_prefix(theme_path)
            .is_some_and(|rest| rest.starts_with('/'))
        || relative_path
            .strip_suffix(theme_path)
            .is_some_and(|rest| rest.ends_with('/'))
        || relative_path.contains(&format!("/{theme_path}/"))
}

fn matches_theme_path_prefix(relative_path: &str, prefix: &str) -> bool {
    relative_path.starts_with(prefix) || relative_path.contains(&format!("/{prefix}"))
}

fn format_bytes(bytes: f64) -> String {
    if bytes % MEGABYTE == 0.0 {
        format!("{} MB", js_number_to_string(bytes / MEGABYTE))
    } else if bytes % KILOBYTE == 0.0 {
        format!("{} KB", js_number_to_string(bytes / KILOBYTE))
    } else {
        format!("{} bytes", js_number_to_string(bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn limits_and_formatting() {
        assert!(max_file_size_limit("templates/product.JSON")
            .is_some_and(|(b, _)| b == 512.0 * KILOBYTE));
        assert!(
            max_file_size_limit("workspace/themes/1/templates/index.liquid")
                .is_some_and(|(b, _)| b == 256.0 * KILOBYTE)
        );
        assert!(max_file_size_limit("_drafts/x/templates/a.json").is_none());
        assert!(max_file_size_limit("README.md").is_none());
        assert_eq!(format_bytes(1.5 * MEGABYTE), "1536 KB");
        assert_eq!(format_bytes(20.0 * MEGABYTE), "20 MB");
        assert_eq!(format_bytes(1025.0), "1025 bytes");
        let src = "a{%- schema -%}xx\n{% endschema %}b{%schema%}{%endschema%}";
        assert_eq!(
            SCHEMA_BLOCK_REGEX
                .find_iter(src)
                .map(|m| m.len())
                .sum::<usize>(),
            src.len() - 2
        );
    }
}
