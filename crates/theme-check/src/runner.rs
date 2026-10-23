//! `index.ts` `check()`, `disabled-checks/index.ts` and `ignore.ts`.

use crate::context::{
    CheckDef, CheckError, Config, Context, Create, Deps, JsonCheck, LiquidCheck, Offense,
};
use crate::json::{visit_json, JsonKind};
use crate::minimatch::Minimatch;
use crate::source::SourceCode;
use crate::visitor::find_current_node;
use liquid_ast::{visit_liquid, Markup, NodeKind, NodeRef, Position};
use regex::Regex;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::LazyLock;

/// A check that threw (TS `onError`).
#[derive(Clone, Debug)]
pub struct CheckFailure {
    pub check: &'static str,
    pub uri: String,
    pub message: String,
}

#[derive(Default)]
pub struct CheckOutput {
    pub offenses: Vec<Offense>,
    pub errors: Vec<CheckFailure>,
}

/// Stack for the threads that parse and check: parsing recurses once per level of nesting, up to
/// [`liquid_parser::MAX_DEPTH`], which takes more than a default thread's 2 MB.
pub(crate) const STACK_SIZE: usize = 64 << 20;

/// `check(theme, config, dependencies)`. Files are independent, so they run on `threads` threads
/// (`0` = all cores); output is in file order either way.
pub fn check<'a>(config: &'a Config, deps: &'a Deps<'a>, threads: usize) -> CheckOutput {
    let ignores: Vec<Vec<Minimatch>> = config
        .checks
        .iter()
        .map(|def| ignore_patterns(config, Some(def), &deps.root_uri))
        .collect();
    let global_ignores = ignore_patterns(config, None, &deps.root_uri);
    let run = |i: usize| check_file(&deps.theme[i], config, deps, &ignores, &global_ignores);

    let n = deps.theme.len();
    let threads = match threads {
        0 => std::thread::available_parallelism().map_or(1, |n| n.get()),
        t => t,
    }
    .min(n.max(1));
    let next = AtomicUsize::new(0);
    let mut per_file: Vec<(usize, CheckOutput)> = std::thread::scope(|s| {
        let handles: Vec<_> = (0..threads)
            .map(|_| {
                std::thread::Builder::new()
                    .stack_size(STACK_SIZE)
                    .spawn_scoped(s, || {
                        let mut out = Vec::new();
                        loop {
                            let i = next.fetch_add(1, Ordering::Relaxed);
                            if i >= n {
                                break out;
                            }
                            out.push((i, run(i)));
                        }
                    })
                    .expect("spawn check thread")
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|h| h.join().expect("check thread panicked"))
            .collect()
    });
    per_file.sort_by_key(|(i, _)| *i);
    let mut out = CheckOutput::default();
    for (_, o) in per_file {
        out.offenses.extend(o.offenses);
        out.errors.extend(o.errors);
    }
    out
}

struct Slot<'a, C: ?Sized> {
    cx: Context<'a>,
    check: Option<Box<C>>,
    dead: bool,
}

fn fail<'a, C: ?Sized>(
    slot: &mut Slot<'a, C>,
    r: Result<(), CheckError>,
    errors: &mut Vec<CheckFailure>,
) {
    if let Err(e) = r {
        slot.dead = true;
        errors.push(CheckFailure {
            check: slot.cx.def.code,
            uri: slot.cx.file.uri.clone(),
            message: e.0,
        });
    }
}

fn new_context<'a>(
    file: &'a SourceCode<'a>,
    config: &'a Config,
    deps: &'a Deps<'a>,
    i: usize,
    def: &'static CheckDef,
) -> Context<'a> {
    Context {
        file,
        deps,
        settings: config.resolved_settings(i),
        def,
        severity: config.severity(def),
        offenses: Vec::new(),
    }
}

fn check_file<'a>(
    file: &'a SourceCode<'a>,
    config: &'a Config,
    deps: &'a Deps<'a>,
    ignores: &[Vec<Minimatch>],
    global_ignores: &[Minimatch],
) -> CheckOutput {
    let mut out = CheckOutput::default();
    let is_ignored = |i: usize| {
        let uri = file.uri.as_str();
        ignores[i]
            .iter()
            .chain(global_ignores)
            .any(|m| m.matches(uri))
    };
    let kind = if file.is_liquid() {
        crate::context::SourceKind::LiquidHtml
    } else {
        crate::context::SourceKind::Json
    };
    let defs = config
        .checks
        .iter()
        .enumerate()
        .filter(|(i, d)| d.kind() == kind && !is_ignored(*i));

    if !file.is_liquid() {
        let mut slots: Vec<Slot<dyn JsonCheck<'a> + 'a>> = Vec::new();
        for (i, &def) in defs {
            let Create::Json(create) = def.create else {
                continue;
            };
            let mut cx = new_context(file, config, deps, i, def);
            let check = create(&mut cx);
            slots.push(Slot {
                cx,
                check,
                dead: false,
            });
        }
        for s in slots.iter_mut() {
            if let Some(c) = s.check.as_mut() {
                let r = c.on_code_path_start(&mut s.cx);
                fail(s, r, &mut out.errors);
            }
        }
        if let Some(ast) = file.json_ast() {
            let (enter, exit) = dispatch_lists(
                &slots,
                |c| (c.node_mask(), c.exit_mask()),
                JsonKind::Literal as usize + 1,
            );
            if !enter.iter().chain(&exit).all(Vec::is_empty) {
                visit_json(ast.to_ref(), |node, ancestors, is_exit| {
                    let list = if is_exit { &exit } else { &enter };
                    for &i in &list[node.kind() as usize] {
                        let s = &mut slots[i];
                        if s.dead {
                            continue;
                        }
                        let c = s.check.as_mut().unwrap();
                        let r = if is_exit {
                            c.node_exit(node, ancestors, &mut s.cx)
                        } else {
                            c.node(node, ancestors, &mut s.cx)
                        };
                        fail(s, r, &mut out.errors);
                    }
                });
            }
            for s in slots.iter_mut().filter(|s| !s.dead) {
                if let Some(c) = s.check.as_mut() {
                    let r = c.on_code_path_end(&mut s.cx);
                    fail(s, r, &mut out.errors);
                }
            }
        }
        for s in slots {
            out.offenses.extend(s.cx.offenses);
        }
        return out;
    }

    // DisabledChecksVisitor only honors `config.ignore`.
    let disabled_checks_on = !global_ignores.iter().any(|m| m.matches(&file.uri));
    let mut slots: Vec<Slot<dyn LiquidCheck<'a> + 'a>> = Vec::new();
    for (i, &def) in defs {
        let Create::Liquid(create) = def.create else {
            continue;
        };
        let mut cx = new_context(file, config, deps, i, def);
        let check = create(&mut cx);
        slots.push(Slot {
            cx,
            check,
            dead: false,
        });
    }
    for s in slots.iter_mut() {
        if let Some(c) = s.check.as_mut() {
            let r = c.on_code_path_start(&mut s.cx);
            fail(s, r, &mut out.errors);
        }
    }
    let mut disabled = DisabledRanges::default();
    if let Some(doc) = file.liquid_ast() {
        let root = NodeRef::Document(doc);
        let (enter, exit) = dispatch_lists(
            &slots,
            |c| (c.node_mask(), c.exit_mask()),
            NodeKind::ALL.len(),
        );
        visit_liquid(root, |node, ancestors, is_exit| {
            if !is_exit && disabled_checks_on {
                match node {
                    NodeRef::LiquidRawTag(t) if t.name == "comment" => {
                        disabled.determine(file, root, &t.body.value, node)
                    }
                    NodeRef::LiquidTag(t) if t.name == "#" => {
                        if let Markup::Str(m) = &t.markup {
                            disabled.determine(file, root, m, node)
                        }
                    }
                    _ => {}
                }
            }
            let list = if is_exit { &exit } else { &enter };
            for &i in &list[node.kind() as usize] {
                let s = &mut slots[i];
                if s.dead {
                    continue;
                }
                let c = s.check.as_mut().unwrap();
                let r = if is_exit {
                    c.node_exit(node, ancestors, &mut s.cx)
                } else {
                    c.node(node, ancestors, &mut s.cx)
                };
                fail(s, r, &mut out.errors);
            }
        });
        for s in slots.iter_mut().filter(|s| !s.dead) {
            if let Some(c) = s.check.as_mut() {
                let r = c.on_code_path_end(&mut s.cx);
                fail(s, r, &mut out.errors);
            }
        }
    }
    for s in slots {
        out.offenses.extend(
            s.cx.offenses
                .into_iter()
                .filter(|o| !disabled.is_disabled(o)),
        );
    }
    out
}

/// Per node kind, the live checks that want it (`node` and `node_exit`).
fn dispatch_lists<C: ?Sized>(
    slots: &[Slot<C>],
    masks: impl Fn(&C) -> (u64, u64),
    kinds: usize,
) -> (Vec<Vec<usize>>, Vec<Vec<usize>>) {
    let mut enter = vec![Vec::new(); kinds];
    let mut exit = vec![Vec::new(); kinds];
    for (i, s) in slots.iter().enumerate() {
        let (Some(c), false) = (&s.check, s.dead) else {
            continue;
        };
        let (m_enter, m_exit) = masks(c);
        for k in 0..kinds {
            if m_enter & (1 << k) != 0 {
                enter[k].push(i);
            }
            if m_exit & (1 << k) != 0 {
                exit[k].push(i);
            }
        }
    }
    (enter, exit)
}

// ---------------------------------------------------------------------------------------------
// Disabled checks

const ALL: &str = "@all";

static COMMAND: LazyLock<Regex> = LazyLock::new(|| {
    // `.` in JS stops at line terminators.
    Regex::new(r"^(?:theme-check-(disable-next-line|disable|enable)) ?([^\n\r\u{2028}\u{2029}]*)")
        .unwrap()
});
static CHECK_SEPARATOR: LazyLock<Regex> = LazyLock::new(|| Regex::new(",[ ]*").unwrap());

/// One file's `Map<CheckName, { from, to? }[]>`, in UTF-16 indices like the offenses.
#[derive(Default)]
struct DisabledRanges {
    by_check: HashMap<String, Vec<(i64, Option<i64>)>>,
}

impl DisabledRanges {
    fn ranges(&mut self, check: &str) -> &mut Vec<(i64, Option<i64>)> {
        self.by_check.entry(check.to_string()).or_default()
    }

    /// `determineRanges(file, value, node)`
    fn determine<'a>(
        &mut self,
        file: &SourceCode<'a>,
        root: NodeRef<'a>,
        value: &str,
        node: NodeRef<'a>,
    ) {
        let Some(caps) = COMMAND.captures(crate::js::trim(value)) else {
            return;
        };
        let command = caps.get(1).map_or("", |m| m.as_str());
        let joined = caps.get(2).map_or("", |m| m.as_str());
        let checks: Vec<&str> = if joined.is_empty() {
            vec![ALL]
        } else {
            CHECK_SEPARATOR.split(joined).collect()
        };
        let idx = |byte: usize| file.position(byte).index;
        let pos = node.position();
        for check in checks {
            match command {
                "disable-next-line" => {
                    if let Some(p) = find_next_line_position(root, node) {
                        let range = (idx(p.start), Some(idx(p.end)));
                        self.ranges(check).push(range);
                    }
                }
                "disable" => {
                    let from = idx(pos.end);
                    self.ranges(check).push((from, None));
                }
                "enable" => {
                    let to = idx(pos.start);
                    if let Some(ranges) = self.by_check.get_mut(check) {
                        if let Some(last) = ranges.last_mut() {
                            last.1 = Some(to);
                        }
                    } else if check == ALL {
                        for r in self.by_check.values_mut().flatten() {
                            if !r.1.is_some_and(|t| t != 0) {
                                r.1 = Some(to);
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    /// `isDisabled(offense)`
    fn is_disabled(&self, o: &Offense) -> bool {
        [ALL, o.check]
            .iter()
            .filter_map(|c| self.by_check.get(*c))
            .flatten()
            .any(|&(from, to)| {
                o.start.index >= from && (!to.is_some_and(|t| t != 0) || o.end.index <= to.unwrap())
            })
    }
}

/// `findNextLinePosition(ast, node)`
fn find_next_line_position<'a>(ast: NodeRef<'a>, node: NodeRef<'a>) -> Option<Position> {
    let (current, ancestors) = find_current_node(ast, node.position().end);
    let parent = ancestors.last().copied();
    let grandparent = ancestors.len().checked_sub(2).map(|i| ancestors[i]);
    let next = get_next_node(parent, current).or_else(|| get_next_node(grandparent, parent?))?;
    Some(match next {
        NodeRef::LiquidRawTag(t) if t.name == "doc" => t.position,
        NodeRef::LiquidRawTag(t) => t.block_start_position,
        NodeRef::LiquidTag(t) => t.block_start_position,
        NodeRef::LiquidBranch(t) => t.block_start_position,
        NodeRef::HtmlElement(t) => t.block_start_position,
        NodeRef::HtmlVoidElement(t) => t.block_start_position,
        NodeRef::HtmlSelfClosingElement(t) => t.block_start_position,
        NodeRef::HtmlRawNode(t) => t.block_start_position,
        NodeRef::HtmlDanglingMarkerClose(t) => t.block_start_position,
        n => n.position(),
    })
}

/// `getNextNode(parentNode, node)`: the sibling after `node`.
fn get_next_node<'a>(parent: Option<NodeRef<'a>>, node: NodeRef<'a>) -> Option<NodeRef<'a>> {
    let siblings: &'a [liquid_ast::Node<'a>] = match parent? {
        NodeRef::LiquidTag(t) => match (&t.markup, &t.children) {
            (Markup::Nodes(m), _) => m,
            (_, Some(c)) => c,
            _ => &[],
        },
        NodeRef::Document(d) => &d.children,
        NodeRef::LiquidBranch(b) => &b.children,
        NodeRef::HtmlElement(e) => &e.children,
        _ => &[],
    };
    let i = siblings.iter().position(|c| c.to_ref().ptr_eq(&node))?;
    siblings.get(i + 1).map(|n| n.to_ref())
}

// ---------------------------------------------------------------------------------------------
// Ignore patterns

/// `isIgnored` patterns for a check (`settings[code].ignore` + `config.ignore`), or just
/// `config.ignore` for `None`. ponytail: non-string `ignore` entries are skipped; TS throws on
/// `.replace`.
pub(crate) fn ignore_patterns(
    config: &Config,
    def: Option<&CheckDef>,
    root_uri: &str,
) -> Vec<Minimatch> {
    let own = def
        .and_then(|d| config.settings.get(d.code))
        .and_then(|s| s.get("ignore"))
        .and_then(|v| v.as_array())
        .map_or(Vec::new(), |a| {
            a.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        });
    let patterns = if def.is_some() {
        own.into_iter()
            .chain(config.ignore.iter().cloned())
            .collect()
    } else {
        config.ignore.clone()
    };
    patterns
        .iter()
        .map(|p| {
            let mut p = match p.strip_prefix('/') {
                Some(rest) => format!("{root_uri}/{rest}"),
                None => p.clone(),
            };
            if !p.is_empty() && !p.starts_with('/') {
                p = format!("**/{p}");
            }
            if let Some(stem) = p.strip_suffix("/*") {
                p = format!("{stem}/**");
            }
            Minimatch::new(&p)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn globs() {
        let config = Config::new(
            Vec::new(),
            Default::default(),
            vec!["/snippets/*".into(), "tests/**".into(), "*.json".into()],
        );
        let ignored = |uri: &str| {
            ignore_patterns(&config, None, "file:///root")
                .iter()
                .any(|m| m.matches(uri))
        };
        assert!(ignored("file:///root/snippets/a/b.liquid"));
        assert!(!ignored("file:///other/snippets/a.liquid"));
        assert!(ignored("file:///root/x/tests/a.liquid"));
        assert!(ignored("file:///root/templates/index.json"));
        assert!(!ignored("file:///root/.x/a.json"));
    }
}
