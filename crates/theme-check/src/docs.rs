//! `ThemeLiquidDocsManager` + `themeLiquidDocsDownloader` (theme-check-docs-updater): the
//! theme-liquid-docs data in the env-paths cache, refreshed once per run when GitHub's
//! `latest.json` revision differs from the cached one, with the build-time data as a fallback.

use crate::context::Mode;
use crate::docset::ThemeDocset;
use serde_json::{Map, Value};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

pub const THEME_LIQUID_DOCS_ROOT: &str =
    "https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main";

/// `Resources`, then `latest`, with their path in the theme-liquid-docs repo.
const RESOURCES: &[(&str, &str)] = &[
    ("filters", "data/filters.json"),
    ("objects", "data/objects.json"),
    ("tags", "data/tags.json"),
    (
        "shopify_system_translations",
        "data/shopify_system_translations.json",
    ),
    ("manifest_theme", "schemas/manifest_theme.json"),
    (
        "manifest_theme_app_extension",
        "schemas/manifest_theme_app_extension.json",
    ),
];

/// TS `SchemaDefinition` with the schema as text (`''` when it can't be loaded).
#[derive(Clone, Debug)]
pub struct SchemaDefinition {
    /// `${ThemeLiquidDocsSchemaRoot}/${relativeUri}`
    pub uri: String,
    pub file_match: Option<Vec<String>>,
    pub schema: String,
}

pub type Logger = Box<dyn Fn(&str) + Send + Sync>;

pub struct ThemeLiquidDocsManager {
    log: Logger,
    /// `envPaths('theme-liquid-docs').cache`
    root: PathBuf,
    /// `SHOPIFY_TLD_ROOT`: a theme-liquid-docs checkout to read instead of GitHub.
    tld_root: Option<String>,
    setup: OnceLock<()>,
    docset: OnceLock<ThemeDocset>,
    theme_schemas: OnceLock<Vec<SchemaDefinition>>,
    app_schemas: OnceLock<Vec<SchemaDefinition>>,
}

impl ThemeLiquidDocsManager {
    pub fn new(log: Logger) -> Self {
        ThemeLiquidDocsManager {
            log,
            root: cache_root(),
            tld_root: std::env::var("SHOPIFY_TLD_ROOT").ok(),
            setup: OnceLock::new(),
            docset: OnceLock::new(),
            theme_schemas: OnceLock::new(),
            app_schemas: OnceLock::new(),
        }
    }

    /// `new AugmentedThemeDocset(manager)`, as `check()` wraps it.
    pub fn docset(&self) -> &ThemeDocset {
        self.docset.get_or_init(|| {
            let list = |name| match self.find_suitable_json(name) {
                Some(Value::Array(a)) => a,
                _ => Vec::new(),
            };
            let translations = match self.find_suitable_json("shopify_system_translations") {
                Some(Value::Object(m)) => m,
                _ => Map::new(),
            };
            ThemeDocset::augmented(list("filters"), list("objects"), list("tags"), translations)
        })
    }

    /// [`Self::docset`], moved out for `Deps`.
    pub fn take_docset(&mut self) -> ThemeDocset {
        self.docset();
        self.docset.take().expect("docset was just initialized")
    }

    /// `schemas(mode)`
    pub fn schemas(&self, mode: Mode) -> &[SchemaDefinition] {
        let (cell, manifest) = match mode {
            Mode::Theme => (&self.theme_schemas, "manifest_theme"),
            Mode::App => (&self.app_schemas, "manifest_theme_app_extension"),
        };
        cell.get_or_init(|| {
            let manifest = self.find_suitable_json(manifest);
            let schemas = manifest
                .as_ref()
                .and_then(|m| m.get("schemas"))
                .and_then(Value::as_array);
            schemas
                .into_iter()
                .flatten()
                .map(|def| {
                    let relative_uri = def
                        .get("uri")
                        .and_then(Value::as_str)
                        .unwrap_or("undefined");
                    let file_match = def.get("fileMatch").and_then(Value::as_array).map(|a| {
                        a.iter()
                            .filter_map(Value::as_str)
                            .map(String::from)
                            .collect()
                    });
                    let schema = self.load_schema(relative_uri).unwrap_or_default();
                    SchemaDefinition {
                        uri: format!("{THEME_LIQUID_DOCS_ROOT}/schemas/{relative_uri}"),
                        file_match,
                        schema,
                    }
                })
                .collect()
        })
    }

    /// `findSuitableResource([loadResource, fallbackResource], JSON.parse, default)`: `None` is
    /// the default value.
    fn find_suitable_json(&self, name: &str) -> Option<Value> {
        self.ensure_setup();
        let parse = |path: PathBuf, what: &str| match std::fs::read_to_string(&path) {
            Ok(text) => {
                match serde_json::from_str::<Value>(&text) {
                    Ok(v) => {
                        (self.log)(&format!("Loaded {what} from {}", path.display()));
                        Some(v)
                    }
                    Err(e) => {
                        (self.log)(&format!("Failed to load or transform {what}({name}) with the following error:\n{e}"));
                        None
                    }
                }
            }
            Err(e) => {
                (self.log)(&format!(
                    "Failed to load or transform {what}({name}) with the following error:\n{e}"
                ));
                None
            }
        };
        parse(self.root.join(format!("{name}.json")), "resource").or_else(|| {
            parse(
                fallback_root()?.join(format!("{name}.json")),
                "fallback resource",
            )
        })
    }

    fn load_schema(&self, relative_uri: &str) -> Option<String> {
        let file = Path::new(relative_uri).file_name()?;
        std::fs::read_to_string(self.root.join(file))
            .or_else(|_| {
                std::fs::read_to_string(fallback_root().ok_or(())?.join(file)).map_err(|_| ())
            })
            .ok()
    }

    /// `setup()`: replace the cache with the latest docs when GitHub's revision differs from its
    /// `latest.json`. Until that succeeds, `latest.json` keeps the old revision, so a failed update
    /// is retried on the next run. Errors are logged and ignored.
    fn ensure_setup(&self) {
        self.setup.get_or_init(|| {
            if let Err(e) = self.try_setup() {
                (self.log)(&format!("Failed to setup with the following error: {e}"));
            }
        });
    }

    fn try_setup(&self) -> Result<(), String> {
        std::fs::create_dir_all(&self.root).map_err(|e| e.to_string())?;
        let latest: Value =
            serde_json::from_str(&self.download("data/latest.json")?).map_err(|e| e.to_string())?;
        if self.latest_revision() == latest["revision"].as_str().unwrap_or("") {
            return Ok(());
        }
        self.replace_docs()
    }

    /// `replaceThemeLiquidDocs(root)`: downloads the docs into a new folder, then swaps it in. So
    /// the cache always holds one complete set: a failed download leaves it as it was, and files
    /// removed upstream don't linger.
    fn replace_docs(&self) -> Result<(), String> {
        let random =
            std::hash::BuildHasher::hash_one(&std::collections::hash_map::RandomState::new(), ());
        let tmp = format!("{}.{}.{random:x}", self.root.display(), std::process::id());
        let (staged, old) = (
            PathBuf::from(format!("{tmp}.tmp")),
            PathBuf::from(format!("{tmp}.old")),
        );
        let result = self.download_docs(&staged).and_then(|()| {
            // ponytail: two renames, not one atomic swap. Readers in between fall back to the bundled docs.
            match std::fs::rename(&self.root, &old) {
                Err(e) if e.kind() != std::io::ErrorKind::NotFound => return Err(e.to_string()),
                _ => {}
            }
            std::fs::rename(&staged, &self.root).map_err(|e| e.to_string())
        });
        let _ = std::fs::remove_dir_all(&staged);
        let _ = std::fs::remove_dir_all(&old);
        result
    }

    /// `downloadThemeLiquidDocs(destination)`: `latest.json`, every resource, and every schema the
    /// manifests list.
    fn download_docs(&self, destination: &Path) -> Result<(), String> {
        std::fs::create_dir_all(destination).map_err(|e| e.to_string())?;
        let write = |file: &str, text: &str| {
            std::fs::write(destination.join(file), text).map_err(|e| e.to_string())
        };
        let mut manifests = Vec::new();
        for (name, remote) in [("latest", "data/latest.json")].iter().chain(RESOURCES) {
            let text = self.download(remote)?;
            write(&format!("{name}.json"), &text)?;
            if name.starts_with("manifest_") {
                manifests.push(serde_json::from_str::<Value>(&text).map_err(|e| e.to_string())?);
            }
        }
        let mut seen = std::collections::HashSet::new();
        for uri in manifests
            .iter()
            .filter_map(|m| m.get("schemas")?.as_array())
            .flatten()
            .filter_map(|s| s.get("uri")?.as_str())
        {
            if seen.insert(uri) {
                let file = Path::new(uri)
                    .file_name()
                    .ok_or("bad schema uri")?
                    .to_string_lossy()
                    .into_owned();
                write(&file, &self.download(&format!("schemas/{uri}"))?)?;
            }
        }
        Ok(())
    }

    fn latest_revision(&self) -> String {
        let text = std::fs::read_to_string(self.root.join("latest.json")).unwrap_or_default();
        let latest: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        latest
            .get("revision")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string()
    }

    /// `download(url)`. A response that isn't 2xx fails.
    fn download(&self, remote: &str) -> Result<String, String> {
        Ok(match &self.tld_root {
            Some(root) => std::fs::read_to_string(format!("{root}/{remote}")).map_err(|e| {
                (self.log)(&format!("Failed to read local file: file:{root}/{remote}"));
                e.to_string()
            })?,
            // ponytail: shells out to curl rather than adding an HTTP client crate.
            None => {
                let out = std::process::Command::new("curl")
                    .args(["-fsL", &format!("{THEME_LIQUID_DOCS_ROOT}/{remote}")])
                    .output()
                    .map_err(|e| e.to_string())?;
                if !out.status.success() {
                    return Err(format!("curl exited with {}", out.status));
                }
                String::from_utf8_lossy(&out.stdout).into_owned()
            }
        })
    }
}

/// `envPaths('theme-liquid-docs').cache` (env-paths adds the `-nodejs` suffix).
fn cache_root() -> PathBuf {
    const NAME: &str = "theme-liquid-docs-nodejs";
    let home = || PathBuf::from(std::env::var_os("HOME").unwrap_or_default());
    if cfg!(target_os = "macos") {
        home().join("Library/Caches").join(NAME)
    } else if cfg!(windows) {
        let local = std::env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|| home().join("AppData/Local"));
        local.join(NAME).join("Cache")
    } else {
        std::env::var_os("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home().join(".cache"))
            .join(NAME)
    }
}

/// The build-time data that the npm package ships next to `dist/`.
/// ponytail: looked up in `data/` next to the executable; embed it if we ever ship a binary.
fn fallback_root() -> Option<PathBuf> {
    Some(std::env::current_exe().ok()?.parent()?.join("data"))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Needs the network or a warm cache: `cargo test -p theme-check docs -- --ignored`.
    #[test]
    #[ignore]
    fn loads_the_docs() {
        let docs = ThemeLiquidDocsManager::new(Box::new(|m| eprintln!("{m}")));
        assert!(docs.docset().filter("image_url").is_some());
        assert!(docs.docset().tag("schema").is_some());
        let schemas = docs.schemas(Mode::Theme);
        assert!(schemas
            .iter()
            .any(|s| s.uri.ends_with("/section.json") && !s.schema.is_empty()));
        assert!(!docs.schemas(Mode::App).is_empty());
    }

    #[test]
    fn replaces_the_cache_as_a_whole() {
        let dir = std::env::temp_dir().join(format!("theme-check-docs-{}", std::process::id()));
        let (tld, root) = (dir.join("tld"), dir.join("cache"));
        let write = |path: PathBuf, text: &str| {
            std::fs::create_dir_all(path.parent().unwrap()).unwrap();
            std::fs::write(path, text).unwrap();
        };
        write(tld.join("data/latest.json"), r#"{"revision": "new"}"#);
        for (_, remote) in &RESOURCES[1..] {
            write(
                tld.join(remote),
                r#"{"schemas": [{"uri": "section.json"}]}"#,
            );
        }
        write(tld.join("schemas/section.json"), "{}");
        write(root.join("latest.json"), r#"{"revision": "old"}"#);
        write(root.join("removed-upstream.json"), "{}");
        let docs = ThemeLiquidDocsManager {
            root: root.clone(),
            tld_root: Some(tld.to_string_lossy().into()),
            ..ThemeLiquidDocsManager::new(Box::new(|_| {}))
        };

        // A download fails: the cache is as it was.
        assert!(docs.try_setup().is_err());
        assert_eq!(docs.latest_revision(), "old");
        assert!(root.join("removed-upstream.json").exists());
        assert_eq!(
            std::fs::read_dir(&dir).unwrap().count(),
            2,
            "no staged folder is left"
        );

        write(tld.join(RESOURCES[0].1), "[]");
        docs.try_setup().unwrap();
        assert_eq!(docs.latest_revision(), "new");
        assert!(root.join("section.json").exists());
        assert!(!root.join("removed-upstream.json").exists());
        assert_eq!(
            std::fs::read_dir(&dir).unwrap().count(),
            2,
            "no old folder is left"
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
