//! `minimatch(path, pattern)` from minimatch@10.2.1 with default options (posix): brace expansion
//! (brace-expansion@5 / balanced-match@4), `**` matching, the extglob AST and its regexp sources,
//! which run on a small backtracking matcher with JS regexp semantics (lookaheads, `u` mode).

use crate::js::is_space;
use std::sync::LazyLock;

/// `minimatch(path, pattern)`. ponytail: compiles the pattern on every call; keep a `Minimatch`
/// when matching one pattern many times.
pub fn minimatch(path: &str, pattern: &str) -> bool {
    Minimatch::new(pattern).matches(path)
}

/// `new Minimatch(pattern)`.
pub struct Minimatch {
    set: Vec<Vec<Part>>,
    negate: bool,
    comment: bool,
    empty: bool,
}

enum Part {
    Globstar,
    Lit(String),
    Re(Matcher),
}

enum Matcher {
    /// The `test` overrides `parse()` installs for the common patterns.
    Star,
    StarDotExt(String),
    Qmarks(usize, String),
    StarDotStar,
    DotStar,
    Regex(JsRegex),
}

impl Matcher {
    fn test(&self, f: &str) -> bool {
        match self {
            Matcher::Star => !f.is_empty() && !f.starts_with('.'),
            Matcher::StarDotExt(ext) => !f.starts_with('.') && f.ends_with(ext.as_str()),
            Matcher::Qmarks(len, ext) => {
                crate::js::len16(f) == *len && !f.starts_with('.') && f.ends_with(ext.as_str())
            }
            Matcher::StarDotStar => !f.starts_with('.') && f.contains('.'),
            Matcher::DotStar => f != "." && f != ".." && f.starts_with('.'),
            Matcher::Regex(re) => re.test(f),
        }
    }
}

impl Minimatch {
    /// ponytail: no `assertValidPattern` length limit (64K), and a regexp JS would reject (`+()`
    /// alone, identity escapes in `u` mode) compiles leniently here instead of throwing.
    pub fn new(pattern: &str) -> Self {
        let mut mm = Minimatch {
            set: Vec::new(),
            negate: false,
            comment: false,
            empty: false,
        };
        if pattern.starts_with('#') {
            mm.comment = true;
            return mm;
        }
        if pattern.is_empty() {
            mm.empty = true;
            return mm;
        }
        // parseNegate
        let bangs = pattern.len() - pattern.trim_start_matches('!').len();
        mm.negate = bangs % 2 == 1;
        let pattern = &pattern[bangs..];
        let mut glob_set: Vec<String> = Vec::new();
        for g in brace_expand(pattern) {
            if !glob_set.contains(&g) {
                glob_set.push(g);
            }
        }
        mm.set = glob_set
            .iter()
            .map(|g| {
                level_one_optimize(slash_split(g))
                    .into_iter()
                    .map(parse)
                    .collect()
            })
            .collect();
        mm
    }

    /// `mm.match(f)`
    pub fn matches(&self, f: &str) -> bool {
        if self.comment {
            return false;
        }
        if self.empty {
            return f.is_empty();
        }
        let file = slash_split(f);
        for pattern in &self.set {
            if match_one(&file, pattern) {
                return !self.negate;
            }
        }
        self.negate
    }
}

/// `p.split(/\/+/)`
fn slash_split(p: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut rest = p;
    while let Some(i) = rest.find('/') {
        out.push(&rest[..i]);
        rest = rest[i..].trim_start_matches('/');
    }
    out.push(rest);
    out
}

fn level_one_optimize(parts: Vec<&str>) -> Vec<&str> {
    let mut set: Vec<&str> = Vec::new();
    for part in parts {
        let prev = set.last().copied();
        if part == "**" && prev == Some("**") {
            continue;
        }
        if part == ".." && prev.is_some_and(|p| !p.is_empty() && p != ".." && p != "." && p != "**")
        {
            set.pop();
            continue;
        }
        set.push(part);
    }
    if set.is_empty() {
        set.push("");
    }
    set
}

fn match_one(file: &[&str], pattern: &[Part]) -> bool {
    let (fl, pl) = (file.len(), pattern.len());
    let (mut fi, mut pi) = (0, 0);
    while fi < fl && pi < pl {
        let f = file[fi];
        match &pattern[pi] {
            Part::Globstar => {
                let pr = pi + 1;
                let swallowable = |s: &str| s != "." && s != ".." && !s.starts_with('.');
                if pr == pl {
                    return file[fi..].iter().all(|s| swallowable(s));
                }
                for fr in fi..fl {
                    if match_one(&file[fr..], &pattern[pr..]) {
                        return true;
                    }
                    if !swallowable(file[fr]) {
                        break;
                    }
                }
                return false;
            }
            Part::Lit(p) => {
                if f != p {
                    return false;
                }
            }
            Part::Re(m) => {
                if !m.test(f) {
                    return false;
                }
            }
        }
        fi += 1;
        pi += 1;
    }
    if fi == fl && pi == pl {
        true
    } else if fi == fl {
        false
    } else {
        fi == fl - 1 && file[fi].is_empty()
    }
}

// ---------------------------------------------------------------------------------------------
// parse(pattern): one path portion

fn parse(pattern: &str) -> Part {
    if pattern == "**" {
        return Part::Globstar;
    }
    if pattern.is_empty() {
        return Part::Lit(String::new());
    }
    let stars = pattern.len() - pattern.trim_start_matches('*').len();
    let ext_ok = |e: &str| !e.contains(['+', '@', '!', '?', '*', '[', '(']);
    let fast = if stars > 0 && stars == pattern.len() {
        Some(Matcher::Star)
    } else if stars > 0 && ext_ok(&pattern[stars..]) {
        Some(Matcher::StarDotExt(pattern[stars..].to_string()))
    } else if let Some(ext) =
        Some(pattern.trim_start_matches('?')).filter(|e| e.len() < pattern.len() && ext_ok(e))
    {
        Some(Matcher::Qmarks(crate::js::len16(pattern), ext.to_string()))
    } else if stars > 0
        && pattern[stars..]
            .strip_prefix('.')
            .is_some_and(|r| !r.is_empty() && r.bytes().all(|c| c == b'*'))
    {
        Some(Matcher::StarDotStar)
    } else if pattern
        .strip_prefix('.')
        .is_some_and(|r| !r.is_empty() && r.bytes().all(|c| c == b'*'))
    {
        Some(Matcher::DotStar)
    } else {
        None
    };
    match Ast::from_glob(pattern).to_mm_pattern() {
        Ok(re) => Part::Re(fast.unwrap_or(Matcher::Regex(re))),
        Err(lit) => Part::Lit(lit),
    }
}

// ---------------------------------------------------------------------------------------------
// ast.js

const START_NO_TRAVERSAL: &str = r"(?!(?:^|/)\.\.?(?:$|/))";
const START_NO_DOT: &str = r"(?!\.)";
const QMARK: &str = "[^/]";
const STAR: &str = "[^/]*?";
const STAR_NO_EMPTY: &str = "[^/]+?";

#[derive(Clone)]
enum P {
    Str(String),
    Ast(usize),
}

struct Node {
    ty: Option<char>,
    parts: Vec<P>,
    parent: Option<usize>,
    parent_index: usize,
    has_magic: Option<bool>,
    uflag: bool,
    empty_ext: bool,
    to_string: Option<String>,
}

/// The `AST` tree as an arena; node 0 is the root.
struct Ast {
    nodes: Vec<Node>,
    negs: Vec<usize>,
    filled_negs: bool,
}

fn is_extglob_type(c: char) -> bool {
    matches!(c, '!' | '?' | '+' | '*' | '@')
}

fn regexp_escape(c: char, out: &mut String) {
    if "-[]{}()*+?.,\\^$|#".contains(c) || is_space(c) {
        out.push('\\');
    }
    out.push(c);
}

impl Ast {
    fn from_glob(pattern: &str) -> Ast {
        let mut ast = Ast {
            nodes: Vec::new(),
            negs: Vec::new(),
            filled_negs: false,
        };
        let root = ast.new_node(None, None);
        let chars: Vec<char> = pattern.chars().collect();
        ast.parse_ast(&chars, root, 0);
        ast
    }

    fn new_node(&mut self, ty: Option<char>, parent: Option<usize>) -> usize {
        let i = self.nodes.len();
        let parent_index = parent.map_or(0, |p| self.nodes[p].parts.len());
        self.nodes.push(Node {
            ty,
            parts: Vec::new(),
            parent,
            parent_index,
            has_magic: ty.map(|_| true),
            uflag: false,
            empty_ext: false,
            to_string: None,
        });
        if ty == Some('!') && !self.filled_negs {
            self.negs.push(i);
        }
        i
    }

    fn push(&mut self, n: usize, p: P) {
        if matches!(&p, P::Str(s) if s.is_empty()) {
            return;
        }
        self.nodes[n].parts.push(p);
    }

    fn parse_ast(&mut self, s: &[char], ast: usize, pos: usize) -> usize {
        let mut escaping = false;
        let mut in_brace = false;
        let mut brace_start = 0;
        let mut brace_neg = false;
        // Shared by both loops: escapes and `[...]` are accumulated as-is.
        macro_rules! common {
            ($c:expr, $i:expr, $acc:expr) => {
                if escaping || $c == '\\' {
                    escaping = !escaping;
                    $acc.push($c);
                    continue;
                }
                if in_brace {
                    if $i == brace_start + 1 {
                        if $c == '^' || $c == '!' {
                            brace_neg = true;
                        }
                    } else if $c == ']' && !($i == brace_start + 2 && brace_neg) {
                        in_brace = false;
                    }
                    $acc.push($c);
                    continue;
                } else if $c == '[' {
                    in_brace = true;
                    brace_start = $i;
                    brace_neg = false;
                    $acc.push($c);
                    continue;
                }
            };
        }
        if self.nodes[ast].ty.is_none() {
            let mut i = pos;
            let mut acc = String::new();
            while i < s.len() {
                let c = s[i];
                i += 1;
                common!(c, i, acc);
                if is_extglob_type(c) && s.get(i) == Some(&'(') {
                    self.push(ast, P::Str(std::mem::take(&mut acc)));
                    let ext = self.new_node(Some(c), Some(ast));
                    i = self.parse_ast(s, ext, i);
                    self.push(ast, P::Ast(ext));
                    continue;
                }
                acc.push(c);
            }
            self.push(ast, P::Str(acc));
            return i;
        }
        // An extglob: `pos` is at the `(`.
        let mut i = pos + 1;
        let mut part = self.new_node(None, Some(ast));
        let mut parts = Vec::new();
        let mut acc = String::new();
        while i < s.len() {
            let c = s[i];
            i += 1;
            common!(c, i, acc);
            if is_extglob_type(c) && s.get(i) == Some(&'(') {
                self.push(part, P::Str(std::mem::take(&mut acc)));
                let ext = self.new_node(Some(c), Some(part));
                self.push(part, P::Ast(ext));
                i = self.parse_ast(s, ext, i);
                continue;
            }
            if c == '|' {
                self.push(part, P::Str(std::mem::take(&mut acc)));
                parts.push(part);
                part = self.new_node(None, Some(ast));
                continue;
            }
            if c == ')' {
                if acc.is_empty() && self.nodes[ast].parts.is_empty() {
                    self.nodes[ast].empty_ext = true;
                }
                self.push(part, P::Str(std::mem::take(&mut acc)));
                for p in parts.into_iter().chain([part]) {
                    self.push(ast, P::Ast(p));
                }
                return i;
            }
            acc.push(c);
        }
        // Unfinished extglob: it's a literal after all.
        let n = &mut self.nodes[ast];
        n.ty = None;
        n.has_magic = None;
        n.parts = vec![P::Str(s[pos - 1..].iter().collect())];
        i
    }

    fn to_string(&mut self, n: usize) -> String {
        if let Some(s) = &self.nodes[n].to_string {
            return s.clone();
        }
        let parts = self.nodes[n].parts.clone();
        let strs: Vec<String> = parts
            .iter()
            .map(|p| match p {
                P::Str(s) => s.clone(),
                P::Ast(a) => self.to_string(*a),
            })
            .collect();
        let s = match self.nodes[n].ty {
            None => strs.join(""),
            Some(t) => format!("{t}({})", strs.join("|")),
        };
        self.nodes[n].to_string = Some(s.clone());
        s
    }

    fn fill_negs(&mut self) {
        if self.filled_negs {
            return;
        }
        self.to_string(0);
        self.filled_negs = true;
        while let Some(n) = self.negs.pop() {
            if self.nodes[n].ty != Some('!') {
                continue;
            }
            // Append everything that comes after `n` in its ancestors to each of its branches.
            let mut p = n;
            while let Some(pp) = self.nodes[p].parent {
                let mut i = self.nodes[p].parent_index + 1;
                while self.nodes[pp].ty.is_none() && i < self.nodes[pp].parts.len() {
                    let src = self.nodes[pp].parts[i].clone();
                    for k in 0..self.nodes[n].parts.len() {
                        let P::Ast(part) = self.nodes[n].parts[k] else {
                            unreachable!("string part in extglob AST")
                        };
                        self.copy_in(part, src.clone());
                    }
                    i += 1;
                }
                p = pp;
            }
        }
    }

    fn copy_in(&mut self, n: usize, part: P) {
        match part {
            P::Str(s) => self.push(n, P::Str(s)),
            P::Ast(a) => {
                let c = self.clone_node(a, n);
                self.push(n, P::Ast(c));
            }
        }
    }

    fn clone_node(&mut self, src: usize, parent: usize) -> usize {
        let c = self.new_node(self.nodes[src].ty, Some(parent));
        for p in self.nodes[src].parts.clone() {
            self.copy_in(c, p);
        }
        c
    }

    fn is_start(&self, n: usize) -> bool {
        let Some(parent) = self.nodes[n].parent else {
            return true;
        };
        if !self.is_start(parent) {
            return false;
        }
        let pi = self.nodes[n].parent_index;
        (0..pi).all(|i| matches!(self.nodes[parent].parts.get(i), Some(P::Ast(a)) if self.nodes[*a].ty == Some('!')))
    }

    fn is_end(&self, n: usize) -> bool {
        let Some(parent) = self.nodes[n].parent else {
            return true;
        };
        if self.nodes[parent].ty == Some('!') {
            return true;
        }
        if !self.is_end(parent) {
            return false;
        }
        if self.nodes[n].ty.is_none() {
            return true;
        }
        self.nodes[n].parent_index + 1 == self.nodes[parent].parts.len()
    }

    /// `toMMPattern()`: the regexp, or `Err(unescaped literal)` when there's no magic.
    fn to_mm_pattern(&mut self) -> Result<JsRegex, String> {
        let (re, body, has_magic, uflag) = self.to_regexp_source(0, None);
        if !has_magic && self.nodes[0].has_magic != Some(true) {
            return Err(body);
        }
        Ok(JsRegex::new(&format!("^{re}$"), uflag))
    }

    /// `toRegExpSource(allowDot)`: (regexp source, unescaped body, hasMagic, needs `u`).
    fn to_regexp_source(
        &mut self,
        n: usize,
        allow_dot: Option<bool>,
    ) -> (String, String, bool, bool) {
        let dot = allow_dot.unwrap_or(false);
        if n == 0 {
            self.fill_negs();
        }
        let is_start = self.is_start(n);
        let is_end = self.is_end(n);
        let Some(ty) = self.nodes[n].ty else {
            let parts = self.nodes[n].parts.clone();
            let no_empty = is_start && is_end && parts.iter().all(|p| matches!(p, P::Str(_)));
            let mut src = String::new();
            for p in &parts {
                let (re, _, hm, uf) = match p {
                    P::Str(s) => parse_glob(s, self.nodes[n].has_magic == Some(true), no_empty),
                    P::Ast(a) => self.to_regexp_source(*a, allow_dot),
                };
                let node = &mut self.nodes[n];
                node.has_magic = Some(node.has_magic == Some(true) || hm);
                node.uflag = node.uflag || uf;
                src.push_str(&re);
            }
            let mut start = "";
            if is_start {
                if let Some(P::Str(first)) = parts.first() {
                    let dot_trav_allowed = parts.len() == 1 && (first == "." || first == "..");
                    if !dot_trav_allowed {
                        let b = src.as_bytes();
                        let aps = |i: usize| matches!(b.get(i), Some(b'[' | b'.'));
                        let need_no_trav = (dot && aps(0))
                            || (src.starts_with(r"\.") && aps(2))
                            || (src.starts_with(r"\.\.") && aps(4));
                        let need_no_dot = !dot && !allow_dot.unwrap_or(false) && aps(0);
                        start = if need_no_trav {
                            START_NO_TRAVERSAL
                        } else if need_no_dot {
                            START_NO_DOT
                        } else {
                            ""
                        };
                    }
                }
            }
            let parent_neg = self.nodes[n]
                .parent
                .is_some_and(|p| self.nodes[p].ty == Some('!'));
            let end = if is_end && self.filled_negs && parent_neg {
                r"(?:$|\/)"
            } else {
                ""
            };
            let node = &self.nodes[n];
            return (
                format!("{start}{src}{end}"),
                unescape(&src),
                node.has_magic == Some(true),
                node.uflag,
            );
        };

        let repeated = ty == '*' || ty == '+';
        let start = if ty == '!' { "(?:(?!(?:" } else { "(?:" };
        let mut body = self.parts_to_regexp(n, dot, is_start && is_end);
        if is_start && is_end && body.is_empty() && ty != '!' {
            // An invalid extglob: it has to match *something* when it's the whole path portion.
            let s = self.to_string(n);
            let node = &mut self.nodes[n];
            node.parts = vec![P::Str(s.clone())];
            node.ty = None;
            node.has_magic = None;
            return (s.clone(), unescape(&s), false, false);
        }
        let mut body_dot_allowed = if !repeated || dot {
            String::new()
        } else {
            self.parts_to_regexp(n, true, is_start && is_end)
        };
        if body_dot_allowed == body {
            body_dot_allowed.clear();
        }
        if !body_dot_allowed.is_empty() {
            body = format!("(?:{body})(?:{body_dot_allowed})*?");
        }
        let final_ = if ty == '!' && self.nodes[n].empty_ext {
            format!(
                "{}{STAR_NO_EMPTY}",
                if is_start && !dot { START_NO_DOT } else { "" }
            )
        } else {
            let close = match ty {
                '!' => format!(
                    ")){}{STAR})",
                    if is_start && !dot && !allow_dot.unwrap_or(false) {
                        START_NO_DOT
                    } else {
                        ""
                    }
                ),
                '@' => ")".into(),
                '?' => ")?".into(),
                '+' if !body_dot_allowed.is_empty() => ")".into(),
                '*' if !body_dot_allowed.is_empty() => ")?".into(),
                t => format!("){t}"),
            };
            format!("{start}{body}{close}")
        };
        let node = &mut self.nodes[n];
        node.has_magic = Some(node.has_magic == Some(true));
        (
            final_,
            unescape(&body),
            node.has_magic == Some(true),
            node.uflag,
        )
    }

    fn parts_to_regexp(&mut self, n: usize, dot: bool, start_and_end: bool) -> String {
        let parts = self.nodes[n].parts.clone();
        let mut out: Vec<String> = Vec::new();
        for p in parts {
            let P::Ast(a) = p else {
                unreachable!("string type in extglob ast")
            };
            let (re, _, _, uf) = self.to_regexp_source(a, Some(dot));
            self.nodes[n].uflag = self.nodes[n].uflag || uf;
            out.push(re);
        }
        out.retain(|p| !start_and_end || !p.is_empty());
        out.join("|")
    }
}

/// `AST.#parseGlob(glob, hasMagic, noEmpty)`
fn parse_glob(glob: &str, has_magic: bool, no_empty: bool) -> (String, String, bool, bool) {
    let chars: Vec<char> = glob.chars().collect();
    let mut escaping = false;
    let mut re = String::new();
    let mut uflag = false;
    let mut in_star = false;
    let mut has_magic = has_magic;
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        i += 1;
        if escaping {
            escaping = false;
            if "().*{}+?[]^$\\!".contains(c) {
                re.push('\\');
            }
            re.push(c);
            continue;
        }
        if c == '*' {
            if in_star {
                continue;
            }
            in_star = true;
            re.push_str(if no_empty && glob.bytes().all(|b| b == b'*') {
                STAR_NO_EMPTY
            } else {
                STAR
            });
            has_magic = true;
            continue;
        }
        in_star = false;
        if c == '\\' {
            if i == chars.len() {
                re.push_str(r"\\");
            } else {
                escaping = true;
            }
            continue;
        }
        if c == '[' {
            let (src, need_uflag, consumed, magic) = parse_class(&chars, i - 1);
            if consumed > 0 {
                re.push_str(&src);
                uflag = uflag || need_uflag;
                i += consumed - 1;
                has_magic = has_magic || magic;
                continue;
            }
        }
        if c == '?' {
            re.push_str(QMARK);
            has_magic = true;
            continue;
        }
        regexp_escape(c, &mut re);
    }
    (re, unescape(glob), has_magic, uflag)
}

/// brace-expressions.js `parseClass(glob, position)`: (source, needs `u`, chars consumed, magic).
fn parse_class(glob: &[char], pos: usize) -> (String, bool, usize, bool) {
    const POSIX: [(&str, &str, bool, bool); 14] = [
        ("[:alnum:]", r"\p{L}\p{Nl}\p{Nd}", true, false),
        ("[:alpha:]", r"\p{L}\p{Nl}", true, false),
        ("[:ascii:]", r"\x00-\x7f", false, false),
        ("[:blank:]", r"\p{Zs}\t", true, false),
        ("[:cntrl:]", r"\p{Cc}", true, false),
        ("[:digit:]", r"\p{Nd}", true, false),
        ("[:graph:]", r"\p{Z}\p{C}", true, true),
        ("[:lower:]", r"\p{Ll}", true, false),
        ("[:print:]", r"\p{C}", true, false),
        ("[:punct:]", r"\p{P}", true, false),
        ("[:space:]", r"\p{Z}\t\r\n\v\f", true, false),
        ("[:upper:]", r"\p{Lu}", true, false),
        ("[:word:]", r"\p{L}\p{Nl}\p{Nd}\p{Pc}", true, false),
        ("[:xdigit:]", "A-Fa-f0-9", false, false),
    ];
    let brace_escape = |c: char, out: &mut String| {
        if "[]\\-".contains(c) {
            out.push('\\');
        }
        out.push(c);
    };
    let starts_with = |s: &str, i: usize| {
        s.chars()
            .enumerate()
            .all(|(k, c)| glob.get(i + k) == Some(&c))
    };
    let mut ranges: Vec<String> = Vec::new();
    let mut negs: Vec<&str> = Vec::new();
    let mut i = pos + 1;
    let mut saw_start = false;
    let mut uflag = false;
    let mut escaping = false;
    let mut negate = false;
    let mut end_pos = pos;
    let mut range_start: Option<char> = None;
    'outer: while i < glob.len() {
        let c = glob[i];
        if (c == '!' || c == '^') && i == pos + 1 {
            negate = true;
            i += 1;
            continue;
        }
        if c == ']' && saw_start && !escaping {
            end_pos = i + 1;
            break;
        }
        saw_start = true;
        if c == '\\' && !escaping {
            escaping = true;
            i += 1;
            continue;
        }
        if c == '[' && !escaping {
            for (cls, unip, u, neg) in POSIX {
                if starts_with(cls, i) {
                    if range_start.is_some() {
                        return ("$.".into(), false, glob.len() - pos, true);
                    }
                    i += cls.chars().count();
                    if neg {
                        negs.push(unip);
                    } else {
                        ranges.push(unip.into());
                    }
                    uflag = uflag || u;
                    continue 'outer;
                }
            }
        }
        escaping = false;
        if let Some(rs) = range_start.take() {
            let mut r = String::new();
            if c > rs {
                brace_escape(rs, &mut r);
                r.push('-');
                brace_escape(c, &mut r);
                ranges.push(r);
            } else if c == rs {
                brace_escape(c, &mut r);
                ranges.push(r);
            }
            i += 1;
            continue;
        }
        if starts_with("-]", i + 1) {
            let mut r = String::new();
            brace_escape(c, &mut r);
            r.push('-');
            ranges.push(r);
            i += 2;
            continue;
        }
        if starts_with("-", i + 1) {
            range_start = Some(c);
            i += 2;
            continue;
        }
        let mut r = String::new();
        brace_escape(c, &mut r);
        ranges.push(r);
        i += 1;
    }
    if end_pos < i {
        return (String::new(), false, 0, false);
    }
    if ranges.is_empty() && negs.is_empty() {
        return ("$.".into(), false, glob.len() - pos, true);
    }
    // `[_]` is a literal `_`. (`/^\\?.$/`: one UTF-16 unit, not a line terminator.)
    if negs.is_empty() && ranges.len() == 1 && !negate {
        let r: Vec<char> = ranges[0].chars().collect();
        let single = |c: char| c.len_utf16() == 1 && !"\n\r\u{2028}\u{2029}".contains(c);
        let lit = match r.as_slice() {
            [c] if single(*c) => Some(*c),
            ['\\', c] if single(*c) => Some(*c),
            _ => None,
        };
        if let Some(c) = lit {
            let mut out = String::new();
            regexp_escape(c, &mut out);
            return (out, false, end_pos - pos, false);
        }
    }
    let sranges = format!("[{}{}]", if negate { "^" } else { "" }, ranges.concat());
    let snegs = format!("[{}{}]", if negate { "" } else { "^" }, negs.concat());
    let comb = if !ranges.is_empty() && !negs.is_empty() {
        format!("({sranges}|{snegs})")
    } else if !ranges.is_empty() {
        sranges
    } else {
        snegs
    };
    (comb, uflag, end_pos - pos, true)
}

/// unescape.js with default options:
/// `s.replace(/((?!\\).|^)\[([^\/\\])\]/g, '$1$2').replace(/\\([^\/])/g, '$1')`.
fn unescape(s: &str) -> String {
    let c: Vec<char> = s.chars().collect();
    let class_char = |k: usize| {
        c.get(k)
            .is_some_and(|&x| x != '/' && x != '\\' && x.len_utf16() == 1)
    };
    let bracketed =
        |k: usize| c.get(k) == Some(&'[') && class_char(k + 1) && c.get(k + 2) == Some(&']');
    let mut a = String::new();
    let mut i = 0;
    while i < c.len() {
        if c[i] != '\\' && !"\n\r\u{2028}\u{2029}".contains(c[i]) && bracketed(i + 1) {
            a.push(c[i]);
            a.push(c[i + 2]);
            i += 4;
        } else if i == 0 && bracketed(0) {
            a.push(c[1]);
            i += 3;
        } else {
            a.push(c[i]);
            i += 1;
        }
    }
    let mut out = String::new();
    let mut it = a.chars().peekable();
    while let Some(ch) = it.next() {
        if ch == '\\' {
            if let Some(&next) = it.peek().filter(|&&n| n != '/') {
                out.push(next);
                it.next();
                continue;
            }
        }
        out.push(ch);
    }
    out
}

// ---------------------------------------------------------------------------------------------
// braceExpand (brace-expansion@5.0.5, balanced-match@4.0.3)

const ESC_SLASH: &str = "\0SLASH\0";
const ESC_OPEN: &str = "\0OPEN\0";
const ESC_CLOSE: &str = "\0CLOSE\0";
const ESC_COMMA: &str = "\0COMMA\0";
const ESC_PERIOD: &str = "\0PERIOD\0";
const EXPANSION_MAX: usize = 100_000;

fn is_line_terminator(c: char) -> bool {
    matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
}

/// minimatch `braceExpand`: only when `/\{(?:(?!\{).)*\}/` matches.
fn brace_expand(pattern: &str) -> Vec<String> {
    let has_set = pattern.match_indices('{').any(|(i, _)| {
        pattern[i + 1..]
            .chars()
            .find(|&c| c == '}' || c == '{' || is_line_terminator(c))
            == Some('}')
    });
    if !has_set {
        return vec![pattern.to_string()];
    }
    let mut s = pattern.to_string();
    if s.starts_with("{}") {
        s = format!("\\{{\\}}{}", &s[2..]);
    }
    let s = s
        .replace("\\\\", ESC_SLASH)
        .replace("\\{", ESC_OPEN)
        .replace("\\}", ESC_CLOSE)
        .replace("\\,", ESC_COMMA)
        .replace("\\.", ESC_PERIOD);
    expand(&s, true)
        .into_iter()
        .map(|e| {
            e.replace(ESC_SLASH, "\\")
                .replace(ESC_OPEN, "{")
                .replace(ESC_CLOSE, "}")
                .replace(ESC_COMMA, ",")
                .replace(ESC_PERIOD, ".")
        })
        .collect()
}

/// balanced-match `balanced('{', '}', str)`: (pre, body, post).
fn balanced(s: &str) -> Option<(&str, &str, &str)> {
    let find = |from: i64| -> i64 {
        let from = from.max(0) as usize;
        if from > s.len() {
            return -1;
        }
        s[from..].find('{').map_or(-1, |i| (i + from) as i64)
    };
    let find_b = |from: i64| -> i64 {
        let from = from.max(0) as usize;
        if from > s.len() {
            return -1;
        }
        s[from..].find('}').map_or(-1, |i| (i + from) as i64)
    };
    let mut ai = find(0);
    let mut bi = find_b(ai + 1);
    let mut i = ai;
    let mut result = None;
    if ai >= 0 && bi > 0 {
        let mut begs: Vec<i64> = Vec::new();
        let mut left = s.len() as i64;
        let mut right = None;
        while i >= 0 && result.is_none() {
            if i == ai {
                begs.push(i);
                ai = find(i + 1);
            } else if begs.len() == 1 {
                result = begs.pop().map(|r| (r, bi));
            } else {
                if let Some(beg) = begs.pop() {
                    if beg < left {
                        left = beg;
                        right = Some(bi);
                    }
                }
                bi = find_b(i + 1);
            }
            i = if ai < bi && ai >= 0 { ai } else { bi };
        }
        if !begs.is_empty() {
            if let Some(r) = right {
                result = Some((left, r));
            }
        }
    }
    let (a, b) = result?;
    let (a, b) = (a as usize, b as usize);
    Some((&s[..a], &s[a + 1..b], &s[b + 1..]))
}

fn parse_comma_parts(s: &str) -> Vec<String> {
    if s.is_empty() {
        return vec![String::new()];
    }
    let Some((pre, body, post)) = balanced(s) else {
        return s.split(',').map(str::to_string).collect();
    };
    let mut p: Vec<String> = pre.split(',').map(str::to_string).collect();
    p.last_mut().unwrap().push_str(&format!("{{{body}}}"));
    let mut post_parts = parse_comma_parts(post);
    if !post.is_empty() {
        let first = post_parts.remove(0);
        p.last_mut().unwrap().push_str(&first);
        p.extend(post_parts);
    }
    p
}

fn is_int(s: &str) -> bool {
    let d = s.strip_prefix('-').unwrap_or(s);
    !d.is_empty() && d.bytes().all(|c| c.is_ascii_digit())
}

fn expand(s: &str, is_top: bool) -> Vec<String> {
    let mut expansions = Vec::new();
    let Some((pre, body, post_str)) = balanced(s) else {
        return vec![s.to_string()];
    };
    let post = if post_str.is_empty() {
        vec![String::new()]
    } else {
        expand(post_str, false)
    };
    if pre.ends_with('$') {
        for p in post.iter().take(EXPANSION_MAX) {
            expansions.push(format!("{pre}{{{body}}}{p}"));
        }
        return expansions;
    }
    let seq: Vec<&str> = body.split("..").collect();
    let is_numeric_seq = (seq.len() == 2 || seq.len() == 3) && seq.iter().all(|p| is_int(p));
    let alpha = |p: &str| p.len() == 1 && p.as_bytes()[0].is_ascii_alphabetic();
    let is_alpha_seq = (seq.len() == 2 || seq.len() == 3)
        && alpha(seq[0])
        && alpha(seq[1])
        && seq.get(2).map_or(true, |p| is_int(p));
    let is_sequence = is_numeric_seq || is_alpha_seq;
    let is_options = body.contains(',');
    if !is_sequence && !is_options {
        // `{a},b}`: `/,(?!,).*\}/`
        let comma_then_close = post_str.match_indices(',').any(|(i, _)| {
            let rest = &post_str[i + 1..];
            !rest.starts_with(',')
                && rest
                    .chars()
                    .take_while(|&c| !is_line_terminator(c))
                    .any(|c| c == '}')
        });
        if comma_then_close {
            return expand(&format!("{pre}{{{body}{ESC_CLOSE}{post_str}"), true);
        }
        return vec![s.to_string()];
    }
    let n: Vec<String> = if is_sequence {
        seq.iter().map(|p| p.to_string()).collect()
    } else {
        let n = parse_comma_parts(body);
        if n.len() == 1 {
            let n: Vec<String> = expand(&n[0], false)
                .into_iter()
                .map(|x| format!("{{{x}}}"))
                .collect();
            if n.len() == 1 {
                return post.iter().map(|p| format!("{pre}{}{p}", n[0])).collect();
            }
            n
        } else {
            n
        }
    };
    let big_n: Vec<String> = if is_sequence {
        // ponytail: i64 arithmetic; JS uses doubles past 2^53.
        let numeric = |p: &str| {
            if is_alpha_seq && !is_int(p) {
                p.as_bytes()[0] as i64
            } else {
                p.parse::<i64>().unwrap_or(0)
            }
        };
        let x = numeric(&n[0]);
        let y = numeric(&n[1]);
        let width = n[0].len().max(n[1].len());
        let mut incr = n.get(2).map_or(1, |p| numeric(p).abs().max(1));
        let reverse = y < x;
        if reverse {
            incr = -incr;
        }
        let pad = n.iter().any(|p| {
            let d = p.strip_prefix('-').unwrap_or(p).as_bytes();
            d.len() >= 2 && d[0] == b'0' && d[1].is_ascii_digit()
        });
        let mut out = Vec::new();
        let mut i = x;
        while if reverse { i >= y } else { i <= y } {
            let c = if is_alpha_seq {
                let c = char::from_u32(i as u32)
                    .map(String::from)
                    .unwrap_or_default();
                if c == "\\" {
                    String::new()
                } else {
                    c
                }
            } else {
                let mut c = i.to_string();
                if pad && width > c.len() {
                    let z = "0".repeat(width - c.len());
                    c = if i < 0 {
                        format!("-{z}{}", &c[1..])
                    } else {
                        format!("{z}{c}")
                    };
                }
                c
            };
            out.push(c);
            i += incr;
        }
        out
    } else {
        n.iter().flat_map(|p| expand(p, false)).collect()
    };
    for nj in &big_n {
        for p in &post {
            if expansions.len() >= EXPANSION_MAX {
                break;
            }
            let e = format!("{pre}{nj}{p}");
            if !is_top || is_sequence || !e.is_empty() {
                expansions.push(e);
            }
        }
    }
    expansions
}

// ---------------------------------------------------------------------------------------------
// A backtracking matcher for the JS regexps above. It only answers `test()`, so greedy and lazy
// quantifiers are the same thing.

struct JsRegex {
    alts: Vec<Vec<Re>>,
    unicode: bool,
}

enum Re {
    Unit(u32),
    Any,
    Class(Class),
    Start,
    End,
    Group(Vec<Vec<Re>>),
    Look(bool, Vec<Vec<Re>>),
    Repeat(Box<Re>, u32, Option<u32>),
}

struct Class {
    negated: bool,
    ranges: Vec<(u32, u32)>,
    /// `\p{..}` / `\P{..}` (u mode) and `\d\w\s` (and negations), as regex-crate classes.
    props: Vec<&'static regex::Regex>,
}

static PROPS: LazyLock<std::sync::Mutex<std::collections::HashMap<String, &'static regex::Regex>>> =
    LazyLock::new(Default::default);

/// A one-char regex-crate class (`\p{L}`, `\d`, ...), compiled once.
fn prop(src: &str) -> &'static regex::Regex {
    let src = match src {
        r"\d" => "[0-9]",
        r"\D" => "[^0-9]",
        r"\w" => "[A-Za-z0-9_]",
        r"\W" => "[^A-Za-z0-9_]",
        r"\s" => {
            r"[\t\n\x0B\f\r \u{a0}\u{1680}\u{2000}-\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}\u{feff}]"
        }
        r"\S" => {
            r"[^\t\n\x0B\f\r \u{a0}\u{1680}\u{2000}-\u{200a}\u{2028}\u{2029}\u{202f}\u{205f}\u{3000}\u{feff}]"
        }
        s => s,
    };
    let mut cache = PROPS.lock().unwrap();
    // ponytail: the regex crate's Unicode tables stand in for V8's; unknown properties match nothing.
    cache.entry(src.to_string()).or_insert_with(|| {
        Box::leak(Box::new(
            regex::Regex::new(&format!("^{src}$"))
                .unwrap_or_else(|_| regex::Regex::new("[^\\s\\S]").unwrap()),
        ))
    })
}

impl Class {
    fn has(&self, u: u32) -> bool {
        let hit = self.ranges.iter().any(|&(lo, hi)| lo <= u && u <= hi)
            || self.props.iter().any(|re| {
                char::from_u32(u).is_some_and(|c| re.is_match(c.encode_utf8(&mut [0; 4])))
            });
        hit != self.negated
    }
}

struct ReParser {
    s: Vec<u32>,
    i: usize,
    unicode: bool,
}

impl ReParser {
    fn peek(&self) -> Option<u32> {
        self.s.get(self.i).copied()
    }
    fn eat(&mut self, c: char) -> bool {
        if self.peek() == Some(c as u32) {
            self.i += 1;
            true
        } else {
            false
        }
    }
    fn starts(&self, lit: &str) -> bool {
        lit.chars()
            .enumerate()
            .all(|(k, c)| self.s.get(self.i + k) == Some(&(c as u32)))
    }

    fn disjunction(&mut self) -> Vec<Vec<Re>> {
        let mut alts = vec![self.alternative()];
        while self.eat('|') {
            alts.push(self.alternative());
        }
        alts
    }

    fn alternative(&mut self) -> Vec<Re> {
        let mut seq = Vec::new();
        while let Some(c) = self.peek() {
            if c == '|' as u32 || c == ')' as u32 {
                break;
            }
            let atom = self.atom();
            let quant = match self.peek().and_then(char::from_u32) {
                Some('*') => Some((0, None)),
                Some('+') => Some((1, None)),
                Some('?') => Some((0, Some(1))),
                _ => None,
            };
            match quant {
                Some((min, max)) if !matches!(atom, Re::Start | Re::End) => {
                    self.i += 1;
                    self.eat('?');
                    seq.push(Re::Repeat(Box::new(atom), min, max));
                }
                _ => seq.push(atom),
            }
        }
        seq
    }

    fn atom(&mut self) -> Re {
        let c = self.s[self.i];
        self.i += 1;
        match char::from_u32(c) {
            Some('^') => Re::Start,
            Some('$') => Re::End,
            Some('.') => Re::Any,
            Some('(') => {
                let look = if self.starts("?!") {
                    Some(true)
                } else if self.starts("?=") {
                    Some(false)
                } else {
                    None
                };
                if look.is_some() || self.starts("?:") {
                    self.i += 2;
                }
                let alts = self.disjunction();
                self.eat(')');
                match look {
                    Some(neg) => Re::Look(neg, alts),
                    None => Re::Group(alts),
                }
            }
            Some('[') => Re::Class(self.class()),
            Some('\\') => match self.escape() {
                Ok(u) => Re::Unit(u),
                Err(props) => Re::Class(Class {
                    negated: false,
                    ranges: Vec::new(),
                    props,
                }),
            },
            // ponytail: a quantifier with nothing to repeat is a SyntaxError in JS; a literal here.
            _ => Re::Unit(c),
        }
    }

    /// After a `\`: a code unit, or a class escape.
    fn escape(&mut self) -> Result<u32, Vec<&'static regex::Regex>> {
        let Some(c) = self.peek() else {
            return Ok('\\' as u32);
        };
        self.i += 1;
        let hex = |p: &mut ReParser, n: usize| -> Option<u32> {
            let digits: String =
                p.s.get(p.i..p.i + n)?
                    .iter()
                    .filter_map(|&u| char::from_u32(u))
                    .collect();
            let v = u32::from_str_radix(&digits, 16)
                .ok()
                .filter(|_| digits.len() == n)?;
            p.i += n;
            Some(v)
        };
        Ok(match char::from_u32(c) {
            Some('t') => 9,
            Some('n') => 10,
            Some('v') => 11,
            Some('f') => 12,
            Some('r') => 13,
            Some('0') => 0,
            Some('x') => hex(self, 2).unwrap_or(c),
            Some('u') => hex(self, 4).unwrap_or(c),
            Some(k @ ('d' | 'D' | 'w' | 'W' | 's' | 'S')) => {
                return Err(vec![prop(&format!("\\{k}"))])
            }
            Some(k @ ('p' | 'P')) if self.unicode && self.eat('{') => {
                let start = self.i;
                while self.peek().is_some_and(|u| u != '}' as u32) {
                    self.i += 1;
                }
                let name: String = self.s[start..self.i]
                    .iter()
                    .filter_map(|&u| char::from_u32(u))
                    .collect();
                self.eat('}');
                return Err(vec![prop(&format!("\\{k}{{{name}}}"))]);
            }
            _ => c,
        })
    }

    fn class(&mut self) -> Class {
        let mut class = Class {
            negated: self.eat('^'),
            ranges: Vec::new(),
            props: Vec::new(),
        };
        while let Some(c) = self.peek() {
            if c == ']' as u32 {
                self.i += 1;
                break;
            }
            let lo = self.class_atom();
            let is_range = self.peek() == Some('-' as u32)
                && self.s.get(self.i + 1).is_some_and(|&u| u != ']' as u32);
            match lo {
                Ok(lo) if is_range => {
                    self.i += 1;
                    match self.class_atom() {
                        Ok(hi) => class.ranges.push((lo, hi)),
                        Err(p) => {
                            class.ranges.push((lo, lo));
                            class.ranges.push(('-' as u32, '-' as u32));
                            class.props.extend(p);
                        }
                    }
                }
                Ok(u) => class.ranges.push((u, u)),
                Err(p) => class.props.extend(p),
            }
        }
        class
    }

    fn class_atom(&mut self) -> Result<u32, Vec<&'static regex::Regex>> {
        let c = self.s[self.i];
        self.i += 1;
        if c != '\\' as u32 {
            return Ok(c);
        }
        if self.eat('b') {
            return Ok(8);
        }
        self.escape()
    }
}

impl JsRegex {
    fn new(src: &str, unicode: bool) -> JsRegex {
        let s: Vec<u32> = if unicode {
            src.chars().map(|c| c as u32).collect()
        } else {
            src.encode_utf16().map(u32::from).collect()
        };
        let mut p = ReParser { s, i: 0, unicode };
        let mut alts = p.disjunction();
        // A stray `)` would end the top level early; JS rejects it, keep going like a literal.
        while p.i < p.s.len() {
            p.i += 1;
            alts.last_mut().unwrap().push(Re::Unit(')' as u32));
            let more = p.disjunction();
            let mut more = more.into_iter();
            alts.last_mut().unwrap().extend(more.next().unwrap());
            alts.extend(more);
        }
        JsRegex { alts, unicode }
    }

    fn test(&self, f: &str) -> bool {
        let s: Vec<u32> = if self.unicode {
            f.chars().map(|c| c as u32).collect()
        } else {
            f.encode_utf16().map(u32::from).collect()
        };
        (0..=s.len()).any(|start| self.alts(&self.alts, &s, start, &mut |_| true))
    }

    fn alts(
        &self,
        alts: &[Vec<Re>],
        s: &[u32],
        pos: usize,
        k: &mut dyn FnMut(usize) -> bool,
    ) -> bool {
        alts.iter().any(|alt| self.seq(alt, s, pos, k))
    }

    fn seq(&self, nodes: &[Re], s: &[u32], pos: usize, k: &mut dyn FnMut(usize) -> bool) -> bool {
        let Some((n, rest)) = nodes.split_first() else {
            return k(pos);
        };
        match n {
            Re::Start => pos == 0 && self.seq(rest, s, pos, k),
            Re::End => pos == s.len() && self.seq(rest, s, pos, k),
            Re::Look(neg, alts) => {
                self.alts(alts, s, pos, &mut |_| true) != *neg && self.seq(rest, s, pos, k)
            }
            Re::Group(alts) => self.alts(alts, s, pos, &mut |p| self.seq(rest, s, p, k)),
            Re::Repeat(atom, min, max) => self.repeat(atom, *min, *max, 0, s, pos, &mut |p| {
                self.seq(rest, s, p, k)
            }),
            Re::Unit(u) => s.get(pos) == Some(u) && self.seq(rest, s, pos + 1, k),
            Re::Any => {
                s.get(pos)
                    .is_some_and(|&u| ![0xA, 0xD, 0x2028, 0x2029].contains(&u))
                    && self.seq(rest, s, pos + 1, k)
            }
            Re::Class(c) => s.get(pos).is_some_and(|&u| c.has(u)) && self.seq(rest, s, pos + 1, k),
        }
    }

    #[allow(clippy::too_many_arguments)]
    fn repeat(
        &self,
        atom: &Re,
        min: u32,
        max: Option<u32>,
        count: u32,
        s: &[u32],
        pos: usize,
        k: &mut dyn FnMut(usize) -> bool,
    ) -> bool {
        // JS: once `min` is met, an iteration that matches the empty string fails.
        if max.map_or(true, |m| count < m)
            && self.seq(std::slice::from_ref(atom), s, pos, &mut |p| {
                (p != pos || count < min) && self.repeat(atom, min, max, count + 1, s, p, k)
            })
        {
            return true;
        }
        count >= min && k(pos)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// minimatch.json has the answers of minimatch@10, which theme-check-common uses, on a grid of
    /// paths and patterns.
    #[test]
    fn matches_node() {
        let v: serde_json::Value = serde_json::from_str(include_str!("minimatch.json")).unwrap();
        let paths: Vec<&str> = v["paths"]
            .as_array()
            .unwrap()
            .iter()
            .map(|p| p.as_str().unwrap())
            .collect();
        let mut bad = Vec::new();
        for case in v["cases"].as_array().unwrap() {
            let pattern = case[0].as_str().unwrap();
            let want: Vec<&str> = case[1]
                .as_array()
                .unwrap()
                .iter()
                .map(|p| p.as_str().unwrap())
                .collect();
            let mm = Minimatch::new(pattern);
            let got: Vec<&str> = paths.iter().copied().filter(|p| mm.matches(p)).collect();
            if got != want {
                bad.push(format!("{pattern:?}: node {want:?}, rust {got:?}"));
            }
        }
        assert!(bad.is_empty(), "{}", bad.join("\n"));
        for (p, want) in [
            ("a{b,c{d,e}f}g", &["abg", "acdfg", "acefg"][..]),
            ("a{01..03}b", &["a01b", "a02b", "a03b"]),
            ("{a,b}{}", &["a{}", "b{}"]),
            ("a{b}c", &["a{b}c"]),
            ("x{a..e..2}", &["xa", "xc", "xe"]),
            ("{a},b}", &["a}", "b"]),
            ("a{,b}", &["a", "ab"]),
            ("{-01..1}", &["-01", "000", "001"]),
            ("{a,b", &["{a,b"]),
            ("${a,b}", &["${a,b}"]),
        ] {
            assert_eq!(brace_expand(p), want, "{p}");
        }
    }
}
