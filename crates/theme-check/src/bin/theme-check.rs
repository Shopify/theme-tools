//! `theme-check <root> [configPath]`: theme-check-node's `cli.ts` (offenses, config and theme
//! uris as JSON on stdout, logs on stderr). `--autofix` runs `checkAndAutofix` instead and prints
//! nothing. A thrown error prints as `Name: message` on stderr and exits 1, like Node's
//! unhandled rejection (minus the stack).

use std::io::Write;
use theme_check::node::{
    check_and_autofix, config_json, offense_json, posix_resolve, stringify, theme_check_run,
    JsError,
};

fn main() {
    let mut autofix = false;
    let mut args = Vec::new();
    for a in std::env::args().skip(1) {
        if a == "--autofix" {
            autofix = true;
        } else {
            args.push(a);
        }
    }
    let Some(root) = args.first() else {
        eprintln!("usage: theme-check <root> [configPath] [--autofix]");
        std::process::exit(2);
    };
    // `path.resolve(arg)`
    let cwd = std::env::current_dir()
        .map(|d| d.to_string_lossy().into_owned())
        .unwrap_or_else(|_| "/".into());
    let resolve = |p: &str| posix_resolve(&cwd, p);
    let root = resolve(root);
    let config_path = args.get(1).filter(|p| !p.is_empty()).map(|p| resolve(p));
    let result: Result<(), JsError> = if autofix {
        check_and_autofix(&root, config_path.as_deref())
    } else {
        theme_check_run(
            &root,
            config_path.as_deref(),
            Box::new(|m| eprintln!("{m}")),
        )
        .map(|run| {
            let offenses: Vec<_> = run.offenses.iter().map(offense_json).collect();
            let out = format!(
                "{}\n{}\n{}\n",
                stringify(&offenses.into()),
                stringify(&config_json(&run.config)),
                stringify(&run.theme.into())
            );
            std::io::stdout()
                .lock()
                .write_all(out.as_bytes())
                .expect("stdout");
        })
    };
    if let Err(e) = result {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
