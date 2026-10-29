//! The `theme-check` binary on small themes: config files, output, exit codes and `--autofix`.
//! Docs come from a local theme-liquid-docs fixture, so nothing is downloaded. Expected values
//! are theme-check-node's on the same files.
// Symlinks, and Windows paths aren't supported yet.
#![cfg(unix)]

use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};

const DOCS: &[(&str, &str)] = &[
    ("tld/data/latest.json", r#"{"revision":"cli"}"#),
    (
        "tld/data/filters.json",
        r#"[{"name":"upcase"},{"name":"downcase"}]"#,
    ),
    ("tld/data/objects.json", "[]"),
    ("tld/data/tags.json", "[]"),
    ("tld/data/shopify_system_translations.json", "{}"),
    (
        "tld/schemas/manifest_theme.json",
        r#"{"schemas":[{"uri":"theme/x.json","fileMatch":["config/x.json"]}]}"#,
    ),
    (
        "tld/schemas/manifest_theme_app_extension.json",
        r#"{"schemas":[]}"#,
    ),
    (
        "tld/schemas/theme/x.json",
        r#"{"type":"object","properties":{"a":{"type":"number"}}}"#,
    ),
];

/// A fresh directory with the docs and `files`.
fn fixture(case: &str, files: &[(&str, &str)]) -> PathBuf {
    let dir = Path::new(env!("CARGO_TARGET_TMPDIR"))
        .join("cli")
        .join(case);
    let _ = std::fs::remove_dir_all(&dir);
    for (path, text) in DOCS.iter().chain(files) {
        let path = dir.join(path);
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(path, text).unwrap();
    }
    dir
}

/// `theme-check <args>` in `dir`, with its own docs cache.
fn theme_check(dir: &Path, args: &[&str]) -> Output {
    Command::new(env!("CARGO_BIN_EXE_theme-check"))
        .args(args)
        .current_dir(dir)
        .env("SHOPIFY_TLD_ROOT", dir.join("tld"))
        .env("HOME", dir.join("home"))
        .env_remove("XDG_CACHE_HOME")
        .output()
        .unwrap()
}

/// A successful run's offenses (as `check severity file start-end`), config and theme, with uris
/// relative to the config's `rootUri`.
fn parse(out: &Output) -> (Vec<String>, Value, Vec<String>) {
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
    let stdout = String::from_utf8(out.stdout.clone()).unwrap();
    assert!(stdout.ends_with("]\n"), "{stdout}");
    let [offenses, config, theme] = <[Value; 3]>::try_from(
        serde_json::Deserializer::from_str(&stdout)
            .into_iter()
            .collect::<Result<Vec<_>, _>>()
            .unwrap(),
    )
    .unwrap();
    let root = format!("{}/", config["rootUri"].as_str().unwrap());
    let rel = |uri: &Value| {
        uri.as_str()
            .unwrap()
            .strip_prefix(&root)
            .unwrap()
            .to_string()
    };
    let pos = |p: &Value| format!("{}:{}", p["line"], p["character"]);
    let mut offenses: Vec<_> = offenses
        .as_array()
        .unwrap()
        .iter()
        .map(|o| {
            let (check, severity) = (o["check"].as_str().unwrap(), &o["severity"]);
            let (start, end) = (pos(&o["start"]), pos(&o["end"]));
            format!("{check} {severity} {} {start}-{end}", rel(&o["uri"]))
        })
        .collect();
    // ponytail: sorted, as Rust groups offenses by check where TS interleaves them.
    offenses.sort();
    let theme = theme.as_array().unwrap().iter().map(rel).collect();
    (offenses, config, theme)
}

fn check_codes(config: &Value) -> Vec<&str> {
    config["checks"]
        .as_array()
        .unwrap()
        .iter()
        .map(|c| c["meta"]["code"].as_str().unwrap())
        .collect()
}

fn failure(out: &Output) -> (Option<i32>, String) {
    assert!(out.stdout.is_empty());
    (
        out.status.code(),
        String::from_utf8_lossy(&out.stderr).into(),
    )
}

#[test]
fn checks_a_theme_with_a_config_file() {
    let bad = "{{ 'x' | nope }}";
    let dir = fixture(
        "theme",
        &[
            // Where the search for third-party checks stops. Shopify's own packages aren't any.
            (
                "theme/node_modules/@shopify/theme-check-node/package.json",
                "{}",
            ),
            (
                "theme/.theme-check.yml",
                "extends: ./base.yml\nroot: dist\ncontext: theme\nignore:\n  - snippets/ignored-too.liquid\nUnknownFilter:\n  severity: warning\n",
            ),
            (
                "theme/base.yml",
                "extends: theme-check:recommended\nroot: elsewhere\ncontext: app\nignore:\n  - snippets/ignored.liquid\nParserBlockingScript:\n  enabled: false\n",
            ),
            ("theme/dist/.hidden/h.liquid", bad),
            // In scope everywhere, so b.liquid's `.shared` is too.
            ("theme/dist/assets/a.css", ".shared { color: red; }"),
            ("theme/dist/config/x.json", r#"{"a": "no"}"#),
            ("theme/dist/sections/s.liquid", r#"<div class="shared"></div>"#),
            ("theme/dist/snippets/a.liquid", bad),
            (
                "theme/dist/snippets/b.liquid",
                "{% stylesheet %}.shared { color: blue; }{% endstylesheet %}",
            ),
            ("theme/dist/snippets/ignored.liquid", bad),
            ("theme/dist/snippets/ignored-too.liquid", bad),
            (
                "theme/dist/snippets/script.liquid",
                r#"<script src="https://example.com/x.js"></script>"#,
            ),
            ("theme/extra/e.liquid", bad),
            ("theme/extra/sub/f.liquid", bad),
        ],
    );
    // A linked directory's files are listed, its directories aren't.
    std::os::unix::fs::symlink("../../extra", dir.join("theme/dist/snippets/link")).unwrap();

    let (offenses, config, theme) = parse(&theme_check(&dir, &["theme"]));
    assert_eq!(
        offenses,
        [
            "OrphanedSnippet 1 snippets/a.liquid 0:0-0:1",
            "OrphanedSnippet 1 snippets/b.liquid 0:0-0:1",
            "OrphanedSnippet 1 snippets/script.liquid 0:0-0:1",
            "RemoteAsset 1 snippets/script.liquid 0:8-0:38",
            "UnknownFilter 1 snippets/a.liquid 0:7-0:13",
            "UnknownFilter 1 snippets/link/e.liquid 0:7-0:13",
            "ValidJSON 0 config/x.json 0:6-0:10",
        ]
    );
    assert_eq!(
        theme,
        [
            "config/x.json",
            "sections/s.liquid",
            "snippets/a.liquid",
            "snippets/b.liquid",
            "snippets/link/e.liquid",
            "snippets/script.liquid",
        ]
    );
    assert_eq!(config["context"], "theme");
    assert!(config["rootUri"]
        .as_str()
        .unwrap()
        .ends_with("/cli/theme/theme/dist"));
    assert_eq!(
        config["ignore"],
        json!([
            "node_modules/**",
            "snippets/ignored.liquid",
            "snippets/ignored-too.liquid"
        ])
    );
    assert_eq!(
        config["settings"]["UnknownFilter"],
        json!({ "enabled": true, "severity": 1 })
    );
    let codes = check_codes(&config);
    assert!(codes.contains(&"UnknownFilter") && !codes.contains(&"ParserBlockingScript"));
}

#[test]
fn uses_the_app_config_in_an_app() {
    let dir = fixture(
        "app",
        &[
            // The search for third-party checks stops at the repo, so this isn't one.
            ("app/.git/HEAD", ""),
            ("node_modules/theme-check-extra/package.json", "{}"),
            ("app/shopify.app.toml", ""),
            // The app schemas don't cover it.
            ("app/config/x.json", r#"{"a": "no"}"#),
            ("legacy.yml", "extends: :theme_app_extensions\n"),
        ],
    );
    for args in [&["app"][..], &["app", "legacy.yml"]] {
        let (offenses, config, theme) = parse(&theme_check(&dir, args));
        assert_eq!(offenses, [""; 0], "{args:?}");
        assert_eq!(theme, ["config/x.json"]);
        assert_eq!(config["context"], "app", "{args:?}");
        assert!(
            check_codes(&config).contains(&"AppBlockValidTags"),
            "{args:?}"
        );
    }
}

#[test]
fn fails_on_a_bad_config() {
    let dir = fixture(
        "bad",
        &[
            ("theme/.git/HEAD", ""),
            ("absolute.yml", "root: /theme\n"),
            ("type.yml", "LiquidNestingDepth:\n  maxDepth: '10'\n"),
            ("theme/snippets/a.liquid", ""),
        ],
    );
    let cwd = std::fs::canonicalize(&dir).unwrap();
    assert_eq!(
        failure(&theme_check(&dir, &["theme", "absolute.yml"])),
        (
            Some(1),
            "Error: the \"root\" property can only be relative\n".into()
        )
    );
    assert_eq!(
        failure(&theme_check(&dir, &["theme", "type.yml"])),
        (
            Some(1),
            "AssertionError [ERR_ASSERTION]: Invalid type for setting maxDepth: expected number, got string\n\n'string' !== 'number'\n\n".into()
        )
    );
    assert_eq!(
        failure(&theme_check(&dir, &["theme", "missing.yml"])),
        (
            Some(1),
            format!(
                "Error: ENOENT: no such file or directory, open '{}/missing.yml'\n",
                cwd.display()
            )
        )
    );
    assert_eq!(failure(&theme_check(&dir, &[])).0, Some(2));
}

#[test]
fn autofixes() {
    let dir = fixture(
        "autofix",
        &[
            ("theme/.git/HEAD", ""),
            (
                "theme/snippets/a.liquid",
                "{{ 'hello' | upcase | | downcase }}\n",
            ),
        ],
    );
    let out = theme_check(&dir, &["theme", "--autofix"]);
    assert!(out.status.success() && out.stdout.is_empty(), "{out:?}");
    assert_eq!(
        std::fs::read_to_string(dir.join("theme/snippets/a.liquid")).unwrap(),
        "{{ 'hello' | upcase | downcase }}\n"
    );
}

#[test]
fn checks_deep_files() {
    // Under TS's limit, but deeper than a debug build parses on a default thread's stack.
    let n = 500;
    let deep = "{% if a %}".repeat(n) + &"{% endif %}".repeat(n);
    let dir = fixture(
        "deep",
        &[("theme/.git/HEAD", ""), ("theme/snippets/a.liquid", &deep)],
    );
    let (offenses, _, _) = parse(&theme_check(&dir, &["theme"]));
    let too_deep = offenses
        .iter()
        .filter(|o| o.starts_with("LiquidNestingDepth "));
    assert_eq!(too_deep.count(), n - 10);
    assert_eq!(
        offenses.len(),
        n - 10 + 2,
        "and LiquidComplexity, OrphanedSnippet"
    );
}
