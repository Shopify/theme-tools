//! `minimatch(path, pattern)` from minimatch@11.0.9 with default options (posix), or with `dot`:
//! brace expansion (brace-expansion@5.1.0 / balanced-match@4.0.4), `**` matching, and the other
//! path portions on the state machines of @isaacs/nonrecursive-glob-match@1.1.0, which match in
//! polynomial time.

use crate::js::len16;
use nonrecursive_glob_match::Matcher;

/// `minimatch(path, pattern)`. ponytail: compiles the pattern on every call; keep a `Minimatch`
/// when matching one pattern many times.
pub fn minimatch(path: &str, pattern: &str) -> bool {
    Minimatch::new(pattern).matches(path)
}

/// `new Minimatch(pattern, options)`.
pub struct Minimatch {
    set: Vec<Vec<Part>>,
    negate: bool,
    /// Comments, and the patterns minimatch throws on, match nothing.
    nothing: bool,
    empty: bool,
    dot: bool,
}

/// The minimatch options this port supports.
#[derive(Clone, Copy, Default)]
pub struct Options {
    /// `**` and wildcards also match path portions that start with a dot.
    pub dot: bool,
}

impl Minimatch {
    pub fn new(pattern: &str) -> Self {
        Self::with_options(pattern, Options::default())
    }

    /// `new Minimatch(pattern, options)`. A pattern minimatch throws on matches nothing: longer
    /// than 64K, with a portion of more than 256 extglobs, or with braces that `mergeRows` makes
    /// into a portion that is too long.
    pub fn with_options(pattern: &str, options: Options) -> Self {
        let mut mm = Minimatch {
            set: Vec::new(),
            negate: false,
            nothing: false,
            empty: false,
            dot: options.dot,
        };
        if pattern.starts_with('#') || len16(pattern) > MAX_PATTERN_LENGTH {
            mm.nothing = true;
            return mm;
        }
        if pattern.is_empty() {
            mm.empty = true;
            return mm;
        }
        // parseNegate
        let bangs = pattern.len() - pattern.trim_start_matches('!').len();
        mm.negate = bangs % 2 == 1;
        match rows(&pattern[bangs..], options.dot) {
            Some(set) => mm.set = set,
            None => mm.nothing = true,
        }
        mm
    }

    /// `mm.match(f)`. ponytail: no `#canMatch` pre-check before splitting the path; it gives the
    /// same answers (the generator of minimatch.json checks that).
    pub fn matches(&self, f: &str) -> bool {
        if self.nothing {
            return false;
        }
        if self.empty {
            return f.is_empty();
        }
        let file = slash_split(f);
        for row in &self.set {
            let hit = if row.iter().any(Part::is_globstar) {
                self.match_globstar(&file, row)
            } else {
                match_one(&file, row, 0, file.len())
            };
            if hit {
                return !self.negate;
            }
        }
        self.negate
    }

    /// `#matchGlobstar(file, pattern, false, 0, 0)`: the portions before the first `**` match the
    /// start of the path, the ones after the last `**` its end, and the ones between, in order,
    /// what's left, which the `**` walk.
    fn match_globstar(&self, file: &[&str], pattern: &[Part]) -> bool {
        let first = pattern.iter().position(Part::is_globstar).unwrap();
        let last = pattern.iter().rposition(Part::is_globstar).unwrap();
        let head = &pattern[..first];
        let body = &pattern[(first + 1).min(last)..last];
        let tail = &pattern[last + 1..];
        let fi = head.len();
        if !head.is_empty() && !match_one(file, head, 0, fi) {
            return false;
        }
        let mut file_tail_match = 0;
        if !tail.is_empty() {
            if tail.len() + fi > file.len() {
                return false;
            }
            let tail_start = file.len() - tail.len();
            if match_one(file, tail, tail_start, file.len()) {
                file_tail_match = tail.len();
            } else {
                // a/**/* matches a/b/: try the tail before a trailing ''.
                if file.last() != Some(&"") || fi + tail.len() == file.len() {
                    return false;
                }
                if !match_one(file, tail, tail_start - 1, file.len()) {
                    return false;
                }
                file_tail_match = tail.len() + 1;
            }
        }
        let end = file.len() - file_tail_match;
        if body.is_empty() {
            // The `**` must walk something, unless there's a tail.
            return (fi..end).all(|i| self.walkable(file[i])) && (file_tail_match > 0 || fi < end);
        }
        let segments: Vec<&[Part]> = body.split(Part::is_globstar).collect();
        let mut need = vec![0; segments.len()];
        let mut after = 0;
        for (i, s) in segments.iter().enumerate().rev() {
            after += s.len();
            need[i] = after;
        }
        let mut walk = Walk {
            file,
            segments: &segments,
            need: &need,
            end,
            saw_tail: file_tail_match > 0,
            tried: vec![false; segments.len() * (file.len() + 1)],
            dot: self.dot,
        };
        walk.sections(fi, 0) == Walked::Match
    }

    /// `**` walks a portion that isn't `.` or `..`, and that doesn't start with a dot unless `dot`.
    fn walkable(&self, f: &str) -> bool {
        walkable(f, self.dot)
    }
}

/// assert-valid-pattern.js `MAX_PATTERN_LENGTH`, in UTF-16 units.
const MAX_PATTERN_LENGTH: usize = 64 * 1024;

/// The `maxGlobstarRecursion` default: the sections between `**` past this many don't match.
const MAX_GLOBSTAR_RECURSION: usize = 200;

/// `MAX_EXTGLOBS`: a portion with more extglobs than this throws, as they could exhaust the stack.
const MAX_EXTGLOBS: usize = 256;

/// A numeric range with at least this many values is matched as one portion, not expanded.
const RANGE_MIN: i64 = 100;

/// `make()`: the rows of path portion patterns. `None` where minimatch throws.
fn rows(pattern: &str, dot: bool) -> Option<Vec<Vec<Part>>> {
    let (mut glob_set, mark) = expand_braces(pattern);
    let mut seen = std::collections::HashSet::new();
    glob_set.retain(|g| seen.insert(g.clone()));
    let mut glob_parts: Vec<Vec<String>> = glob_set
        .iter()
        .map(|g| level_one_optimize(slash_split(g)))
        .collect();
    let mut set = glob_parts
        .iter()
        .map(|row| row.iter().map(|p| parse(p, mark)).collect())
        .collect::<Option<Vec<Vec<Part>>>>()?;
    merge_rows(&mut set, &mut glob_parts, mark)?;
    // The Matchers of the rows that are left.
    for (row, parts) in set.iter_mut().zip(&glob_parts) {
        for (part, p) in row.iter_mut().zip(parts) {
            if let Part::Pending = part {
                if extglob_count(p) > MAX_EXTGLOBS {
                    return None;
                }
                *part = Part::Glob(Matcher::new(p, dot, mark));
            }
        }
    }
    Some(set)
}

/// A path portion of a pattern.
enum Part {
    Globstar,
    Lit(String),
    Glob(Matcher),
    /// `PENDING`: a Matcher, made once `mergeRows` has merged the rows.
    Pending,
}

impl Part {
    fn is_globstar(&self) -> bool {
        matches!(self, Part::Globstar)
    }

    /// `portionMatch(p, f)`: an empty path portion only matches an empty pattern portion.
    fn matches(&self, f: &str) -> bool {
        match self {
            Part::Globstar | Part::Pending => false,
            Part::Lit(p) => f == p,
            Part::Glob(m) => !f.is_empty() && m.test(f),
        }
    }
}

fn walkable(f: &str, dot: bool) -> bool {
    f != "." && f != ".." && (dot || !f.starts_with('.'))
}

/// `#matchOne(file, pattern, false, fi, 0, file_end)`: the pattern, without `**`, matches the
/// portions from `fi` to `file_end`, or to the `''` before it of a trailing `/`.
fn match_one(file: &[&str], pattern: &[Part], mut fi: usize, file_end: usize) -> bool {
    let fl = file_end.min(file.len());
    let mut pi = 0;
    while fi < fl && pi < pattern.len() {
        if !pattern[pi].matches(file[fi]) {
            return false;
        }
        fi += 1;
        pi += 1;
    }
    if fi == fl {
        return pi == pattern.len();
    }
    fi + 1 == fl && file[fi].is_empty()
}

/// `#matchGlobStarBodySections`: the sections between the first and last `**` of a pattern.
struct Walk<'a> {
    file: &'a [&'a str],
    segments: &'a [&'a [Part]],
    /// The portions that each section and the ones after it match.
    need: &'a [usize],
    /// Where the tail starts in the path.
    end: usize,
    saw_tail: bool,
    /// The places a walk has failed from, by section and path portion.
    tried: Vec<bool>,
    dot: bool,
}

#[derive(PartialEq)]
enum Walked {
    Match,
    NoMatch,
    /// The section is nowhere after this, so it isn't after any later place either.
    Off,
}

impl Walk<'_> {
    fn sections(&mut self, mut fi: usize, si: usize) -> Walked {
        let Some(&section) = self.segments.get(si) else {
            // The last `**`, before the tail, walks the rest.
            let rest = fi..self.end;
            let saw = self.saw_tail || !rest.is_empty();
            let ok = rest.into_iter().all(|i| walkable(self.file[i], self.dot));
            return if ok && saw {
                Walked::Match
            } else {
                Walked::NoMatch
            };
        };
        let Some(last) = self.end.checked_sub(self.need[si]) else {
            return Walked::Off;
        };
        while fi <= last {
            let key = si * (self.file.len() + 1) + fi;
            if self.tried[key] {
                return Walked::NoMatch;
            }
            self.tried[key] = true;
            // Past the recursion limit, a section doesn't match: a false negative, on purpose.
            if si < MAX_GLOBSTAR_RECURSION && match_one(self.file, section, fi, fi + section.len())
            {
                let rest = self.sections(fi + section.len(), si + 1);
                if rest != Walked::NoMatch {
                    return rest;
                }
            }
            if fi == last {
                break;
            }
            if !walkable(self.file[fi], self.dot) {
                return Walked::NoMatch;
            }
            fi += 1;
        }
        Walked::Off
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

/// `levelOneOptimize`: no `**` after `**`, and `x/..` resolved.
fn level_one_optimize(parts: Vec<&str>) -> Vec<String> {
    let mut set: Vec<String> = Vec::new();
    for part in parts {
        let prev = set.last().map(String::as_str);
        if part == "**" && prev == Some("**") {
            continue;
        }
        if part == ".." && prev.is_some_and(|p| !p.is_empty() && p != ".." && p != "." && p != "**")
        {
            set.pop();
            continue;
        }
        set.push(part.to_string());
    }
    if set.is_empty() {
        set.push(String::new());
    }
    set
}

/// `parse(pattern)`: one path portion, with a Matcher `Pending`. `None` where minimatch throws:
/// past `MAX_PATTERN_LENGTH`, which a portion that `mergeRows` makes can be. A portion with a
/// range `mark` is never literal.
fn parse(pattern: &str, mark: Option<char>) -> Option<Part> {
    if len16(pattern) > MAX_PATTERN_LENGTH {
        return None;
    }
    if pattern == "**" {
        return Some(Part::Globstar);
    }
    if pattern.is_empty() {
        return Some(Part::Lit(String::new()));
    }
    if !mark.is_some_and(|m| pattern.contains(m)) {
        if let Some(lit) = literal(pattern) {
            return Some(Part::Lit(lit));
        }
    }
    Some(Part::Pending)
}

/// `extglobCount(pattern)`: the extglob openers, such as `*(`, counting those in a class too.
fn extglob_count(pattern: &str) -> usize {
    let c: Vec<char> = pattern.chars().collect();
    let mut n = 0;
    let mut i = 0;
    while i + 1 < c.len() {
        if c[i] == '\\' {
            i += 1;
        } else if "+@!?*".contains(c[i]) && c[i + 1] == '(' {
            n += 1;
            i += 1;
        }
        i += 1;
    }
    n
}

/// `literal(pattern)`: the string a portion without magic matches. It can see magic in a pattern
/// that is literal (`[]`), never the reverse. `[.]` is the literal `.`, which a Matcher wouldn't
/// match.
fn literal(pattern: &str) -> Option<String> {
    if pattern == "+()" || pattern == "@()" {
        return Some(pattern.to_string());
    }
    let c: Vec<char> = pattern.chars().collect();
    let mut lit = String::new();
    let mut i = 0;
    while i < c.len() {
        match c[i] {
            '\\' => {
                // a trailing \ is a literal \
                i += 1;
                lit.push(c.get(i).copied().unwrap_or('\\'));
            }
            '*' | '?' => return None,
            '[' => match class_end(&c, i) {
                None => lit.push('['),
                Some(close) => {
                    // a class of one char, such as `[*]` or `[\b]`, is a literal
                    let body = &c[i + 1..close];
                    let body = body.strip_prefix(&['\\'][..]).unwrap_or(body);
                    if body.len() != 1 || matches!(c[i + 1], '!' | '^') {
                        return None;
                    }
                    lit.push(body[0]);
                    i = close;
                }
            },
            '+' | '@' | '!' if c.get(i + 1) == Some(&'(') && c[i + 2..].contains(&')') => {
                return None
            }
            ch => lit.push(ch),
        }
        i += 1;
    }
    Some(lit)
}

/// `classEnd(pattern, start)`: the `]` that closes the class at `start`. It doesn't skip posix
/// classes, so it can find a `]` before the real end.
fn class_end(c: &[char], start: usize) -> Option<usize> {
    let mut i = start + 1;
    if matches!(c.get(i), Some('!' | '^')) {
        i += 1;
    }
    let mut saw_start = false;
    while i < c.len() {
        if c[i] == ']' && saw_start {
            return Some(i);
        }
        saw_start = true;
        if c[i] == '\\' {
            i += 1;
        }
        i += 1;
    }
    None
}

/// `/^[?*+@]\(\)$/`: only an empty extglob, which is literal on its own.
fn is_empty_ext(pattern: &str) -> bool {
    pattern.len() == 3
        && matches!(pattern.as_bytes()[0], b'?' | b'*' | b'+' | b'@')
        && pattern.ends_with("()")
}

/// `extSafe(pattern)`: the portion means the same as an alternative inside `@(...)`.
fn ext_safe(pattern: &str) -> bool {
    if is_empty_ext(pattern) || pattern.contains("[:") {
        return false;
    }
    let c: Vec<char> = pattern.chars().collect();
    let mut depth = 0;
    let mut i = 0;
    while i < c.len() {
        match c[i] {
            '\\' => {
                i += 1;
                if i == c.len() {
                    return false;
                }
            }
            '[' => {
                if let Some(close) = class_end(&c, i) {
                    i = close;
                }
            }
            '+' | '@' | '!' | '?' | '*' if c.get(i + 1) == Some(&'(') => {
                depth += 1;
                i += 1;
            }
            ')' => {
                if depth == 0 {
                    return false;
                }
                depth -= 1;
            }
            '|' if depth == 0 => return false,
            _ => {}
        }
        i += 1;
    }
    depth == 0
}

/// `mergeRows()`: rows that only differ in one portion, a Matcher in each, become one row with
/// `@(a|b|...)` there, unless that has too many extglobs. `None` if the merged portion is too
/// long.
fn merge_rows(
    set: &mut Vec<Vec<Part>>,
    glob_parts: &mut Vec<Vec<String>>,
    mark: Option<char>,
) -> Option<()> {
    let mut merged = true;
    while merged {
        merged = false;
        if set.len() < 2 {
            return Some(());
        }
        let len = set.iter().map(Vec::len).max().unwrap_or(0);
        for k in 0..len {
            // the rows that are the same other than at portion k, in the order of their first row
            let mut keys = std::collections::HashMap::new();
            let mut groups: Vec<Vec<usize>> = Vec::new();
            for (i, row) in set.iter().enumerate() {
                if !matches!(row.get(k), Some(Part::Pending)) || !ext_safe(&glob_parts[i][k]) {
                    continue;
                }
                let mut parts = glob_parts[i].clone();
                parts[k] = String::new();
                let key = format!("{}/{}", row.len(), parts.join("/"));
                let g = *keys.entry(key).or_insert_with(|| {
                    groups.push(Vec::new());
                    groups.len() - 1
                });
                groups[g].push(i);
            }
            let mut drop = vec![false; set.len()];
            for g in groups.iter().filter(|g| g.len() > 1) {
                let alts: Vec<&str> = g.iter().map(|&i| glob_parts[i][k].as_str()).collect();
                let glob = format!("@({})", alts.join("|"));
                if extglob_count(&glob) > MAX_EXTGLOBS {
                    continue;
                }
                set[g[0]][k] = parse(&glob, mark)?;
                glob_parts[g[0]][k] = glob;
                for &i in &g[1..] {
                    drop[i] = true;
                }
            }
            if drop.contains(&true) {
                merged = true;
                *set = keep(std::mem::take(set), &drop);
                *glob_parts = keep(std::mem::take(glob_parts), &drop);
                if set.len() < 2 {
                    return Some(());
                }
            }
        }
    }
    Some(())
}

fn keep<T>(rows: Vec<T>, drop: &[bool]) -> Vec<T> {
    rows.into_iter()
        .zip(drop)
        .filter_map(|(row, &d)| (!d).then_some(row))
        .collect()
}

/// `#expandBraces()`: `braceExpand`, except the numeric ranges with at least `RANGE_MIN` values,
/// such as `{0..999}`, which stay as `<mark>0..999<mark>` for the Matcher. All of them expand
/// when one might be in a class, or in an extglob that repeats or negates it.
fn expand_braces(pattern: &str) -> (Vec<String>, Option<char>) {
    let Some(mark) = ('\u{e000}'..='\u{f8ff}').find(|&c| !pattern.contains(c)) else {
        return (brace_expand(pattern), None);
    };
    let Some(marked) = mark_ranges(pattern, mark) else {
        return (brace_expand(pattern), None);
    };
    let set = brace_expand(&marked);
    for portion in set.iter().flat_map(|p| p.split('/')) {
        let class = portion
            .find('[')
            .is_some_and(|c| portion.rfind(mark).is_some_and(|m| c < m));
        if class || in_repeat_or_neg_ext(portion, mark) {
            return (brace_expand(pattern), None);
        }
    }
    (set, Some(mark))
}

/// `pattern.replace(/(?<![\\$])\{(-?\d+)\.\.(-?\d+)\}/g, ...)` with the ranges that have at least
/// `RANGE_MIN` values marked. `None` if none are.
fn mark_ranges(pattern: &str, mark: char) -> Option<String> {
    static RANGE: std::sync::LazyLock<regex::Regex> =
        std::sync::LazyLock::new(|| regex::Regex::new(r"\{(-?[0-9]+)\.\.(-?[0-9]+)\}").unwrap());
    let mut found = false;
    let marked = RANGE.replace_all(pattern, |c: &regex::Captures| {
        let whole = c.get(0).unwrap();
        let escaped = matches!(
            pattern[..whole.start()].chars().next_back(),
            Some('\\' | '$')
        );
        let wide = match (safe_int(&c[1]), safe_int(&c[2])) {
            (Some(a), Some(b)) => (a - b).abs() + 1 >= RANGE_MIN,
            _ => false,
        };
        if escaped || !wide {
            return whole.as_str().to_string();
        }
        found = true;
        format!("{mark}{}..{}{mark}", &c[1], &c[2])
    });
    found.then(|| marked.into_owned())
}

/// `inRepeatOrNegExt(portion, mark)`: a mark is inside `!(...)`, `*(...)` or `+(...)`, where one
/// Matcher for the range doesn't match what one pattern per value does.
fn in_repeat_or_neg_ext(portion: &str, mark: char) -> bool {
    let c: Vec<char> = portion.chars().collect();
    let mut stack = Vec::new();
    let mut i = 0;
    while i < c.len() {
        if c[i] == '\\' {
            i += 1;
        } else if c[i] == mark {
            if stack.iter().any(|&t| t != '@' && t != '?') {
                return true;
            }
        } else if c.get(i + 1) == Some(&'(') && "!?+*@".contains(c[i]) {
            stack.push(c[i]);
            i += 1;
        } else if c[i] == ')' {
            stack.pop();
        }
        i += 1;
    }
    false
}

/// `Number(s)` of `-?\d+`, if it's a safe integer.
fn safe_int(s: &str) -> Option<i64> {
    let (negative, digits) = match s.strip_prefix('-') {
        Some(d) => (true, d),
        None => (false, s),
    };
    let digits = digits.trim_start_matches('0');
    if digits.len() > 16 {
        return None;
    }
    let n = if digits.is_empty() {
        0
    } else {
        digits.parse::<i64>().ok()?
    };
    if n > (1 << 53) - 1 {
        return None;
    }
    Some(if negative { -n } else { n })
}

/// minimatch `braceExpand`: only when `/\{(?:(?!\{).)*\}/` matches.
fn brace_expand(pattern: &str) -> Vec<String> {
    let has_set = pattern.match_indices('{').any(|(i, _)| {
        pattern[i + 1..]
            .chars()
            .find(|&c| c == '}' || c == '{' || brace_expansion::is_line_terminator(c))
            == Some('}')
    });
    if !has_set {
        return vec![pattern.to_string()];
    }
    // brace-expansion makes `\\` one `\`, which would escape the next char. Doubled, it stays `\\`.
    brace_expansion::expand(&pattern.replace("\\\\", "\\\\\\\\"))
}

/// brace-expansion@5.1.0 `expand(str)`, with balanced-match@4.0.4.
mod brace_expansion {
    use crate::js::len16;

    const ESC_SLASH: &str = "\0SLASH\0";
    const ESC_OPEN: &str = "\0OPEN\0";
    const ESC_CLOSE: &str = "\0CLOSE\0";
    const ESC_COMMA: &str = "\0COMMA\0";
    const ESC_PERIOD: &str = "\0PERIOD\0";
    /// The most results.
    const EXPANSION_MAX: usize = 100_000;
    /// The most UTF-16 units in the results together.
    const EXPANSION_MAX_LENGTH: usize = 4_000_000;
    /// Sets nested deeper stay literal.
    const EXPANSION_MAX_DEPTH: usize = 1_000;
    /// The most `{a},b}` rewrites.
    const EXPANSION_MAX_REWRITES: usize = 1_000;
    /// The work one `expand` does: each char scanned, result built and sequence value made is a
    /// step. Past it, the set being expanded and everything after it stay literal.
    const EXPANSION_MAX_STEPS: i64 = 20_000_000;
    /// What one `expand_` call costs on top of what it scans and builds.
    const CALL_STEPS: i64 = 16;
    const EMPTY: &[String] = &[String::new()];

    pub(super) fn is_line_terminator(c: char) -> bool {
        matches!(c, '\n' | '\r' | '\u{2028}' | '\u{2029}')
    }

    pub(super) fn expand(s: &str) -> Vec<String> {
        if s.is_empty() {
            return Vec::new();
        }
        // Bash keeps a leading {} at the top level.
        let s = match s.strip_prefix("{}") {
            Some(rest) => format!("\\{{\\}}{rest}"),
            None => s.to_string(),
        };
        let s = s
            .replace("\\\\", ESC_SLASH)
            .replace("\\{", ESC_OPEN)
            .replace("\\}", ESC_CLOSE)
            .replace("\\,", ESC_COMMA)
            .replace("\\.", ESC_PERIOD);
        let mut budget = Budget(EXPANSION_MAX_STEPS);
        budget
            .expand(s, 0, true)
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

    /// The steps left. Once it's overdrawn, every scan refuses.
    struct Budget(i64);

    /// The first brace set of a string, from `balanced`.
    struct Set<'a> {
        /// Where its `}` is.
        end: usize,
        pre: &'a str,
        body: &'a str,
        post: &'a str,
        /// A `{` without a `}` comes before it.
        unmatched: bool,
    }

    impl Budget {
        fn spend(&mut self, steps: usize) {
            self.0 -= steps as i64;
        }

        fn out(&self) -> bool {
            self.0 < 0
        }

        /// `expand_(str, ..., depth, ..., isTop)`: the brace sets at the top level of `s`, left to
        /// right, combined with the results so far.
        fn expand(&mut self, mut s: String, depth: usize, mut is_top: bool) -> Vec<String> {
            self.0 -= CALL_STEPS;
            if depth > EXPANSION_MAX_DEPTH {
                return vec![s];
            }
            let mut acc = vec![String::new()];
            let mut rewrites = 0;
            // Bash drops empty results, only when the first set is a comma set.
            let mut drop_empties = false;
            let mut first_group = true;
            // `s` with its unmatched `{` masked, once a scan has run into them
            let mut masked = s.clone();
            loop {
                let Some(set) = self.balanced(&s, &masked) else {
                    return self.combine(&acc, &s, EMPTY, drop_empties);
                };
                let end = set.end;
                let (pre, body, post) = (
                    set.pre.to_string(),
                    set.body.to_string(),
                    set.post.to_string(),
                );
                if set.unmatched {
                    masked = self.mask_unmatched_opens(&masked);
                }
                // This set and the rest of the string, literal: for a set that can't expand, and
                // for one the budget runs out on.
                let literal = |budget: &mut Budget, acc: &[String], drop_empties: bool| {
                    budget.combine(acc, &format!("{pre}{{{body}}}{post}"), EMPTY, drop_empties)
                };
                let last = post.is_empty();
                if pre.ends_with('$') {
                    acc = self.combine(
                        &acc,
                        &format!("{pre}{{{body}}}"),
                        EMPTY,
                        drop_empties && last,
                    );
                    first_group = false;
                    if last {
                        break;
                    }
                    masked = masked[end + 1..].to_string();
                    s = post;
                    continue;
                }
                let seq: Vec<&str> = body.split("..").collect();
                let pair = seq.len() == 2 || seq.len() == 3;
                let is_numeric_seq = pair && seq.iter().all(|p| is_int(p));
                let alpha = |p: &str| p.len() == 1 && p.as_bytes()[0].is_ascii_alphabetic();
                let is_alpha_seq =
                    pair && alpha(seq[0]) && alpha(seq[1]) && seq.get(2).is_none_or(|p| is_int(p));
                let is_sequence = is_numeric_seq || is_alpha_seq;
                if !is_sequence && !body.contains(',') {
                    // {a},b}
                    if rewrites < EXPANSION_MAX_REWRITES && self.comma_set_follows(&post) {
                        rewrites += 1;
                        s = format!("{pre}{{{body}{ESC_CLOSE}{post}");
                        masked = format!("{}{ESC_CLOSE}{}", &masked[..end], &masked[end + 1..]);
                        is_top = true;
                        continue;
                    }
                    return literal(self, &acc, drop_empties);
                }
                if first_group {
                    drop_empties = is_top && !is_sequence;
                    first_group = false;
                }
                let values = if is_sequence {
                    let Some(values) = self.sequence(&seq, is_alpha_seq) else {
                        return literal(self, &acc, drop_empties);
                    };
                    values
                } else {
                    let Some(mut n) = self.parse_comma_parts(&body) else {
                        return literal(self, &acc, drop_empties);
                    };
                    if n.len() == 1 {
                        // x{{a,b}}y ==> x{a}y x{b}y
                        n = self
                            .expand(n.remove(0), depth + 1, false)
                            .into_iter()
                            .map(|x| format!("{{{x}}}"))
                            .collect();
                        if self.out() {
                            return literal(self, &acc, drop_empties);
                        }
                        if n.len() == 1 {
                            let next = self.combine(
                                &acc,
                                &format!("{pre}{}", n[0]),
                                EMPTY,
                                drop_empties && last,
                            );
                            if self.out() {
                                return literal(self, &acc, drop_empties);
                            }
                            acc = next;
                            if last {
                                break;
                            }
                            masked = masked[end + 1..].to_string();
                            s = post;
                            continue;
                        }
                    }
                    // The values that combine() would drop don't count against the limits.
                    let drops_empties =
                        drop_empties && last && pre.is_empty() && acc.iter().all(String::is_empty);
                    let mut values = Vec::new();
                    let mut length = 0;
                    'parts: for nj in n {
                        let expanded = self.expand(nj, depth + 1, false);
                        if self.out() {
                            return literal(self, &acc, drop_empties);
                        }
                        for v in expanded {
                            if drops_empties && v.is_empty() {
                                continue;
                            }
                            if values.len() >= EXPANSION_MAX
                                || length + len16(&v) > EXPANSION_MAX_LENGTH
                            {
                                break 'parts;
                            }
                            length += len16(&v);
                            values.push(v);
                        }
                    }
                    values
                };
                let next = self.combine(&acc, &pre, &values, drop_empties && last);
                if self.out() {
                    return literal(self, &acc, drop_empties);
                }
                acc = next;
                if last {
                    break;
                }
                masked = masked[end + 1..].to_string();
                s = post;
            }
            acc
        }

        /// `balancedWithBudget(str, masked)`: the first set, found in `masked` and sliced from
        /// `s`, charged for the chars walked.
        fn balanced<'a>(&mut self, s: &'a str, masked: &str) -> Option<Set<'a>> {
            if self.out() {
                return None;
            }
            let r = range(masked);
            let unmatched = r.is_some_and(|(a, _)| masked.find('{').is_some_and(|i| i < a));
            self.spend(match r {
                Some((_, b)) if !unmatched => len16(&masked[..=b]),
                _ => len16(s),
            });
            let (a, b) = r?;
            if self.out() {
                return None;
            }
            Some(Set {
                end: b,
                pre: &s[..a],
                body: &s[a + 1..b],
                post: &s[b + 1..],
                unmatched,
            })
        }

        /// `maskUnmatchedOpens(masked)`: each `{` without a `}` becomes `\0`, so later scans stop
        /// at the set's `}`.
        fn mask_unmatched_opens(&mut self, masked: &str) -> String {
            self.spend(len16(masked));
            let mut open = Vec::new();
            for (i, c) in masked.bytes().enumerate() {
                if c == b'{' {
                    open.push(i);
                } else if c == b'}' {
                    open.pop();
                }
            }
            let mut out = masked.as_bytes().to_vec();
            for i in open {
                out[i] = 0;
            }
            String::from_utf8(out).unwrap()
        }

        /// `commaSetFollows(post)`: `/,(?!,).*\}/.test(post)`, charged for the whole string.
        fn comma_set_follows(&mut self, post: &str) -> bool {
            self.spend(len16(post));
            if self.out() {
                return false;
            }
            let mut close = false;
            let mut next = None;
            for c in post.chars().rev() {
                if c == '}' {
                    close = true;
                } else if is_line_terminator(c) {
                    close = false;
                } else if c == ',' && close && next != Some(',') {
                    return true;
                }
                next = Some(c);
            }
            false
        }

        /// `combine(acc, pre, values, ...)`: each `acc + pre + value`, within the limits.
        fn combine(
            &mut self,
            acc: &[String],
            pre: &str,
            values: &[String],
            drop_empties: bool,
        ) -> Vec<String> {
            let mut out = Vec::new();
            let mut length = 0;
            'acc: for a in acc {
                let prefix = format!("{a}{pre}");
                // Only an empty prefix makes an empty result.
                let skip_empties = drop_empties && prefix.is_empty();
                for v in values.iter().filter(|v| !skip_empties || !v.is_empty()) {
                    if out.len() >= EXPANSION_MAX {
                        break 'acc;
                    }
                    let e = format!("{prefix}{v}");
                    if length + len16(&e) > EXPANSION_MAX_LENGTH {
                        break 'acc;
                    }
                    length += len16(&e);
                    out.push(e);
                }
            }
            self.spend(out.len());
            out
        }

        /// `expandSequence(body, isAlphaSequence)`: `1..5`, `01..10..2`, `a..e`.
        fn sequence(&mut self, n: &[&str], is_alpha: bool) -> Option<Vec<String>> {
            // ponytail: i64 arithmetic; JS uses doubles past 2^53.
            let numeric = |p: &str| {
                if is_int(p) {
                    p.parse::<i64>().unwrap_or(0)
                } else {
                    p.as_bytes()[0] as i64
                }
            };
            let x = numeric(n[0]);
            let y = numeric(n[1]);
            let width = n[0].len().max(n[1].len());
            let mut incr = n.get(2).map_or(1, |p| numeric(p).abs().max(1));
            let reverse = y < x;
            if reverse {
                incr = -incr;
            }
            let pad = n.iter().any(|p| is_padded(p));
            // A padded value is built a char at a time.
            let cost = if pad { width } else { 1 };
            let mut out = Vec::new();
            let mut length = 0;
            let mut i = x;
            while (if reverse { i >= y } else { i <= y }) && out.len() < EXPANSION_MAX {
                self.spend(cost);
                if self.out() {
                    return None;
                }
                let c = if is_alpha {
                    match char::from_u32(i as u32) {
                        Some('\\') | None => String::new(),
                        Some(c) => c.to_string(),
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
                if length + c.len() > EXPANSION_MAX_LENGTH {
                    break;
                }
                length += c.len();
                out.push(c);
                i += incr;
            }
            Some(out)
        }

        /// `parseCommaParts(str)`: `str.split(',')`, keeping nested sets like `{a,{b,c},d}`
        /// whole. `None` if the budget runs out on the way.
        fn parse_comma_parts(&mut self, mut s: &str) -> Option<Vec<String>> {
            let mut parts = Vec::new();
            let mut carry = String::new();
            loop {
                let set = self.balanced(s, s);
                if self.out() {
                    return None;
                }
                let Some(Set {
                    pre, body, post, ..
                }) = set
                else {
                    let mut tail: Vec<String> = s.split(',').map(str::to_string).collect();
                    tail[0].insert_str(0, &carry);
                    parts.extend(tail);
                    return Some(parts);
                };
                let mut p: Vec<String> = pre.split(',').map(str::to_string).collect();
                p[0].insert_str(0, &carry);
                p.last_mut().unwrap().push_str(&format!("{{{body}}}"));
                if post.is_empty() {
                    parts.extend(p);
                    return Some(parts);
                }
                carry = p.pop().unwrap();
                parts.extend(p);
                s = post;
            }
        }
    }

    fn is_int(s: &str) -> bool {
        let d = s.strip_prefix('-').unwrap_or(s);
        !d.is_empty() && d.bytes().all(|c| c.is_ascii_digit())
    }

    /// `/^-?0\d/`
    pub(super) fn is_padded(s: &str) -> bool {
        let d = s.strip_prefix('-').unwrap_or(s).as_bytes();
        d.len() >= 2 && d[0] == b'0' && d[1].is_ascii_digit()
    }

    /// balanced-match `range('{', '}', str)`: where the first set's `{` and `}` are.
    fn range(s: &str) -> Option<(usize, usize)> {
        let find = |c: char, from: i64| -> i64 {
            let from = from.max(0) as usize;
            if from > s.len() {
                return -1;
            }
            s[from..].find(c).map_or(-1, |i| (i + from) as i64)
        };
        let mut ai = find('{', 0);
        let mut bi = find('}', ai + 1);
        let mut i = ai;
        let mut result = None;
        if ai >= 0 && bi > 0 {
            let mut begs: Vec<i64> = Vec::new();
            let mut left = s.len() as i64;
            let mut right = None;
            while i >= 0 && result.is_none() {
                if i == ai {
                    begs.push(i);
                    ai = find('{', i + 1);
                } else if begs.len() == 1 {
                    result = begs.pop().map(|r| (r, bi));
                } else {
                    if let Some(beg) = begs.pop() {
                        if beg < left {
                            left = beg;
                            right = Some(bi);
                        }
                    }
                    bi = find('}', i + 1);
                }
                i = if ai < bi && ai >= 0 { ai } else { bi };
            }
            if !begs.is_empty() {
                if let Some(r) = right {
                    result = Some((left, r));
                }
            }
        }
        result.map(|(a, b)| (a as usize, b as usize))
    }

    #[cfg(test)]
    mod tests {
        #[test]
        fn expand() {
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
                ("{,}", &[]),
                ("{a,,b}", &["a", "b"]),
                ("{{a,b}}", &["{a}", "{b}"]),
                ("{Z..b}", &["Z", "[", "", "]", "^", "_", "`", "a", "b"]),
                ("{a,{b,c}", &["{a,b", "{a,c"]),
            ] {
                assert_eq!(super::expand(p), want, "{p}");
            }
        }

        #[test]
        fn limits() {
            assert_eq!(super::expand(&"{a,b}".repeat(20)).len(), 100_000);
            // The step budget runs out on the fifth set, which stays literal with the rest.
            let sets = format!("{{{}..99999}}", "0".repeat(100)).repeat(5);
            let out = super::expand(&sets);
            assert_eq!(out.len(), 7_858);
            assert_eq!(out[0].len(), 509);
        }
    }
}

/// @isaacs/nonrecursive-glob-match@1.1.0 `Matcher`, with the options minimatch passes: one path
/// portion, `dot`. A pattern becomes a state machine, and a string walks it one char at a time
/// with all of its threads at once, so there's no backtracking.
mod nonrecursive_glob_match {
    use std::collections::HashMap;
    use std::sync::LazyLock;

    /// `new Matcher(pattern, { dot, rangeMark })`.
    pub(super) struct Matcher {
        nodes: Vec<Node>,
        start: usize,
        dot: bool,
        /// The string to compare, when the pattern has no magic.
        literal: Option<String>,
        /// The nodes between the prefix and the suffix, if the machine is a single chain.
        linear: Option<Vec<usize>>,
        /// The linear nodes are only `*` and `?`, so the lengths and the affixes decide.
        wild: bool,
        /// The least and most chars a match has (`usize::MAX` for any number).
        min: usize,
        max: usize,
        /// The literals a match starts and ends with.
        prefix: String,
        suffix: String,
    }

    impl Matcher {
        /// `<mark><lo>..<hi><mark>` in the pattern matches the numbers that `{<lo>..<hi>}` expands
        /// to.
        pub(super) fn new(pattern: &str, dot: bool, mark: Option<char>) -> Matcher {
            let chars: Vec<char> = pattern.chars().collect();
            // A pattern that is only an empty extglob is literal, except `!()`.
            let toks = tokenize(&chars, super::is_empty_ext(pattern), mark);
            let pairs = pair(&toks);
            let items = build(&toks, &pairs, 0, toks.len(), true).remove(0);
            let mut compiler = Compiler {
                nodes: vec![Node::Match],
            };
            let start = compiler.seq(&items, MATCH);
            let mut m = Matcher {
                nodes: compiler.nodes,
                start,
                dot,
                literal: None,
                linear: None,
                wild: false,
                min: 0,
                max: usize::MAX,
                prefix: String::new(),
                suffix: String::new(),
            };
            let lit = |it: &Item| match it {
                Item::Lit(c) => Some(*c),
                _ => None,
            };
            if items.iter().all(|it| lit(it).is_some()) {
                m.literal = Some(items.iter().filter_map(lit).collect());
                return m;
            }
            m.prefix = items.iter().map_while(lit).collect();
            let suffix: Vec<char> = items.iter().rev().map_while(lit).collect();
            m.suffix = suffix.iter().rev().collect();
            m.linear = m.chain().map(|chain| {
                let start = m.prefix.chars().count();
                chain[start..chain.len() - suffix.len()].to_vec()
            });
            m.wild = m.linear.as_ref().is_some_and(|l| {
                l.iter()
                    .all(|&n| matches!(m.nodes[n], Node::Star(_) | Node::Any(_)))
            });
            (m.min, m.max) = lengths(&items);
            m
        }

        /// `m.testUnchecked(s)`: `s` is one path portion.
        pub(super) fn test(&self, s: &str) -> bool {
            if let Some(lit) = &self.literal {
                return s == lit;
            }
            let chars: Vec<char> = s.chars().collect();
            if chars.len() < self.min || chars.len() > self.max {
                return false;
            }
            if !s.starts_with(&self.prefix) || !s.ends_with(&self.suffix) {
                return false;
            }
            let dot_start = !self.dot && s.starts_with('.');
            // `.` and `..` only match literal dots, even with `dot`.
            let dots = s == "." || s == "..";
            if let Some(linear) = &self.linear {
                // Only a literal can match a leading dot.
                if dots || (dot_start && self.prefix.is_empty()) {
                    return false;
                }
                if self.wild {
                    return true;
                }
                let start = self.prefix.chars().count();
                let end = chars.len() - self.suffix.chars().count();
                return self.test_linear(linear, &chars[start..end]);
            }
            let mut sim = Sim {
                nodes: &self.nodes,
                dots,
                dot_start,
                has: vec![0; self.nodes.len()],
                seen: vec![0; self.nodes.len()],
                gen: 0,
            };
            let mut state = sim.state();
            sim.add(&mut state, self.start, 0, true);
            let mut state = sim.done(state);
            for (i, &c) in chars.iter().enumerate() {
                if state.dead() {
                    return false;
                }
                state = sim.step(&state, c, i, true);
            }
            state.matched
        }

        /// `linear(start)`: the nodes in order, if the machine is a single chain.
        fn chain(&self) -> Option<Vec<usize>> {
            let mut out = Vec::new();
            let mut n = self.start;
            loop {
                match self.nodes[n] {
                    Node::Match => return Some(out),
                    Node::Split(_) | Node::Neg { .. } => return None,
                    Node::Lit(_, next)
                    | Node::Any(next)
                    | Node::Star(next)
                    | Node::Class(_, next) => {
                        out.push(n);
                        n = next;
                    }
                }
            }
        }

        /// `testLinear`: each node other than `*` matches one char, so a miss goes back to the
        /// last `*`, which takes one more char.
        fn test_linear(&self, nodes: &[usize], chars: &[char]) -> bool {
            let (mut ni, mut ci) = (0, 0);
            let mut star: Option<(usize, usize)> = None;
            while ci < chars.len() {
                let node = nodes.get(ni).map(|&n| &self.nodes[n]);
                if let Some(Node::Star(_)) = node {
                    star = Some((ni, ci));
                    ni += 1;
                    continue;
                }
                let c = chars[ci];
                let hit = match node {
                    Some(Node::Any(_)) => true,
                    Some(Node::Lit(l, _)) => *l == c,
                    Some(Node::Class(class, _)) => class.has(c),
                    _ => false,
                };
                if hit {
                    ni += 1;
                    ci += 1;
                    continue;
                }
                let Some((sn, sc)) = star else {
                    return false;
                };
                star = Some((sn, sc + 1));
                ni = sn + 1;
                ci = sc + 1;
            }
            while let Some(Node::Star(_)) = nodes.get(ni).map(|&n| &self.nodes[n]) {
                ni += 1;
            }
            ni == nodes.len()
        }
    }

    #[derive(Clone)]
    enum Item {
        Lit(char),
        Any,
        Star,
        Class(Class),
        Ext(char, Vec<Vec<Item>>),
    }

    /// Extglob syntax is literal when it isn't part of a closed extglob.
    enum Token {
        Item(Item),
        Open(char),
        Bar,
        Close,
    }

    fn tokenize(p: &[char], noext: bool, mark: Option<char>) -> Vec<Token> {
        let mut toks = Vec::new();
        let mut i = 0;
        while i < p.len() {
            let c = p[i];
            if let Some((range, end)) = mark.and_then(|mark| marked_range(p, i, mark)) {
                toks.push(Token::Item(Item::Ext('@', range)));
                i = end;
                continue;
            }
            if c == '\\' {
                // a trailing \ is a literal \
                toks.push(Token::Item(Item::Lit(
                    p.get(i + 1).copied().unwrap_or('\\'),
                )));
                i += 2;
                continue;
            }
            if c == '[' {
                if let Some((class, consumed)) = parse_class(p, i) {
                    toks.push(Token::Item(Item::Class(class)));
                    i += consumed;
                    continue;
                }
            }
            if !noext && "!?+*@".contains(c) && p.get(i + 1) == Some(&'(') {
                toks.push(Token::Open(c));
                i += 2;
                continue;
            }
            toks.push(match c {
                '|' if !noext => Token::Bar,
                ')' if !noext => Token::Close,
                '*' => Token::Item(Item::Star),
                '?' => Token::Item(Item::Any),
                c => Token::Item(Item::Lit(c)),
            });
            i += 1;
        }
        toks
    }

    /// A range at `i`, `<mark><lo>..<hi><mark>`, with a `\\` before it or not, which only escapes
    /// its first char: the alternatives of an `@(...)`, and where the range ends.
    fn marked_range(p: &[char], i: usize, mark: char) -> Option<(Vec<Vec<Item>>, usize)> {
        let start = match p[i] {
            '\\' if p.get(i + 1) == Some(&mark) => i + 2,
            c if c == mark => i + 1,
            _ => return None,
        };
        let end = start + p.get(start..)?.iter().position(|&c| c == mark)?;
        let body: String = p[start..end].iter().collect();
        let (lo, hi) = body.split_once("..")?;
        let int = |s: &str| {
            let d = s.strip_prefix('-').unwrap_or(s);
            !d.is_empty() && d.bytes().all(|b| b.is_ascii_digit())
        };
        if !int(lo) || !int(hi) {
            return None;
        }
        Some((numeric_range(lo, hi)?, end + 1))
    }

    /// numeric-range.js `numericRange(lo, hi)`: the strings that `{lo..hi}` expands to, as
    /// sequences of digits and digit classes, so even a large range has few of them. With a
    /// leading zero at either end, each one is as long as the longer end, counting a `-`.
    fn numeric_range(lo_s: &str, hi_s: &str) -> Option<Vec<Vec<Item>>> {
        let mut lo = super::safe_int(lo_s)?;
        let mut hi = super::safe_int(hi_s)?;
        if lo > hi {
            std::mem::swap(&mut lo, &mut hi);
        }
        let padded =
            super::brace_expansion::is_padded(lo_s) || super::brace_expansion::is_padded(hi_s);
        let width = if padded {
            lo_s.len().max(hi_s.len())
        } else {
            0
        };
        let mut out = Vec::new();
        if lo < 0 {
            for mut s in nonneg((-hi).max(1), -lo, width.saturating_sub(1)) {
                s.insert(0, Item::Lit('-'));
                out.push(s);
            }
        }
        if hi >= 0 {
            out.extend(nonneg(lo.max(0), hi, width));
        }
        Some(out)
    }

    /// `nonneg(a, b, width)`: the numbers from a to b, where 0 <= a <= b, padded to `width`.
    fn nonneg(a: i64, b: i64, width: usize) -> Vec<Vec<Item>> {
        if width > 0 {
            return fixed(
                format!("{a:0width$}").as_bytes(),
                format!("{b:0width$}").as_bytes(),
            );
        }
        let mut out = Vec::new();
        for len in a.to_string().len()..=b.to_string().len() {
            let lo = a.max(if len == 1 {
                0
            } else {
                10i64.pow(len as u32 - 1)
            });
            let hi = b.min(10i64.pow(len as u32) - 1);
            out.extend(fixed(lo.to_string().as_bytes(), hi.to_string().as_bytes()));
        }
        out
    }

    /// `fixed(a, b)`: the digit strings from a to b, which have the same length. The digits they
    /// share come first in each one, without a recursion for each: padding can make thousands.
    /// The rest is at most 16 digits, as `b` is a safe integer.
    fn fixed(a: &[u8], b: &[u8]) -> Vec<Vec<Item>> {
        let same = a.iter().zip(b).take_while(|(x, y)| x == y).count();
        let alts = differing(&a[same..], &b[same..]);
        if same == 0 {
            return alts;
        }
        let head: Vec<Item> = a[..same]
            .iter()
            .map(|&d| digit(d - b'0', d - b'0'))
            .collect();
        alts.into_iter()
            .map(|s| head.iter().cloned().chain(s).collect())
            .collect()
    }

    /// `fixed(a, b)` where the first digits differ, or there are none.
    fn differing(a: &[u8], b: &[u8]) -> Vec<Vec<Item>> {
        let Some((&a0, ra)) = a.split_first() else {
            return vec![Vec::new()];
        };
        let (&b0, rb) = b.split_first().unwrap();
        let (mut lo, mut hi) = (a0 - b'0', b0 - b'0');
        let zeros = vec![b'0'; ra.len()];
        let nines = vec![b'9'; ra.len()];
        let mut out = Vec::new();
        if ra != zeros {
            out.extend(prefix(lo, fixed(ra, &nines)));
            lo += 1;
        }
        let mut last = Vec::new();
        if rb != nines {
            last = prefix(hi, fixed(&zeros, rb));
            hi -= 1;
        }
        if lo <= hi {
            let mut s = vec![digit(lo, hi)];
            s.extend(ra.iter().map(|_| digit(0, 9)));
            out.push(s);
        }
        out.extend(last);
        out
    }

    fn prefix(d: u8, alts: Vec<Vec<Item>>) -> Vec<Vec<Item>> {
        alts.into_iter()
            .map(|mut s| {
                s.insert(0, digit(d, d));
                s
            })
            .collect()
    }

    /// One digit, or a class of the digits from a to b.
    fn digit(a: u8, b: u8) -> Item {
        let (a, b) = (char::from(b'0' + a), char::from(b'0' + b));
        if a == b {
            return Item::Lit(a);
        }
        Item::Class(Class {
            ranges: vec![(a, b)],
            ..Class::default()
        })
    }

    /// `pair(toks)`: the close token of each open token.
    fn pair(toks: &[Token]) -> HashMap<usize, usize> {
        let mut pairs = HashMap::new();
        let mut stack = Vec::new();
        for (i, tok) in toks.iter().enumerate() {
            match tok {
                Token::Open(_) => stack.push(i),
                Token::Close => {
                    if let Some(open) = stack.pop() {
                        pairs.insert(open, i);
                    }
                }
                _ => {}
            }
        }
        pairs
    }

    /// `build(toks, pairs, start, end, top)`: the alternatives between start and end. An open
    /// token that isn't closed is never inside a closed extglob, so `|` and `)` are only literal
    /// at the top level.
    fn build(
        toks: &[Token],
        pairs: &HashMap<usize, usize>,
        start: usize,
        end: usize,
        top: bool,
    ) -> Vec<Vec<Item>> {
        let mut alts = vec![Vec::new()];
        let mut i = start;
        while i < end {
            let seq = alts.last_mut().unwrap();
            match &toks[i] {
                Token::Open(ty) => match pairs.get(&i) {
                    Some(&close) => {
                        seq.push(Item::Ext(*ty, build(toks, pairs, i + 1, close, false)));
                        i = close;
                    }
                    None => {
                        seq.push(Item::Lit(*ty));
                        seq.push(Item::Lit('('));
                    }
                },
                Token::Bar if !top => alts.push(Vec::new()),
                Token::Bar => seq.push(Item::Lit('|')),
                Token::Close => seq.push(Item::Lit(')')),
                Token::Item(it) => seq.push(it.clone()),
            }
            i += 1;
        }
        alts
    }

    /// `lengths(items)`: the least and most chars the items match, as bounds.
    fn lengths(items: &[Item]) -> (usize, usize) {
        let (mut min, mut max) = (0, 0);
        for it in items {
            let (lo, hi) = item_lengths(it);
            min += lo;
            max = hi.saturating_add(max);
        }
        (min, max)
    }

    fn item_lengths(it: &Item) -> (usize, usize) {
        let Item::Ext(ty, alts) = it else {
            return if matches!(it, Item::Star) {
                (0, usize::MAX)
            } else {
                (1, 1)
            };
        };
        if *ty == '!' {
            return (0, usize::MAX);
        }
        let (mut min, mut max) = (usize::MAX, 0);
        for a in alts {
            let (lo, hi) = lengths(a);
            min = min.min(lo);
            max = max.max(hi);
        }
        // a loop of alternatives that only match the empty string is empty
        let repeat = if max == 0 { 0 } else { usize::MAX };
        match ty {
            '@' => (min, max),
            '?' => (0, max),
            '*' => (0, repeat),
            _ => (min, repeat),
        }
    }

    /// The end of the pattern, or of a negated sub-pattern.
    const MATCH: usize = 0;

    /// A state machine node, by index; `next` and `out` are indexes too.
    enum Node {
        Match,
        Lit(char, usize),
        Any(usize),
        Star(usize),
        Class(Class, usize),
        Split(Vec<usize>),
        /// `!(...)`: the chars so far match if `sub`, which ends at `MATCH`, doesn't.
        Neg {
            sub: usize,
            next: usize,
        },
    }

    struct Compiler {
        nodes: Vec<Node>,
    }

    impl Compiler {
        fn push(&mut self, n: Node) -> usize {
            self.nodes.push(n);
            self.nodes.len() - 1
        }

        // Loops rather than iterator adapters keep the stack small for nested extglobs.
        fn seq(&mut self, items: &[Item], mut next: usize) -> usize {
            for it in items.iter().rev() {
                next = self.item(it, next);
            }
            next
        }

        fn alts(&mut self, alts: &[Vec<Item>], next: usize) -> Vec<usize> {
            let mut out = Vec::with_capacity(alts.len() + 1);
            for a in alts {
                out.push(self.seq(a, next));
            }
            out
        }

        fn item(&mut self, it: &Item, next: usize) -> usize {
            let (ty, alts) = match it {
                Item::Lit(c) => return self.push(Node::Lit(*c, next)),
                Item::Any => return self.push(Node::Any(next)),
                Item::Star => return self.push(Node::Star(next)),
                Item::Class(c) => return self.push(Node::Class(c.clone(), next)),
                Item::Ext(ty, alts) => (*ty, alts),
            };
            match ty {
                '@' => {
                    let out = self.alts(alts, next);
                    self.push(Node::Split(out))
                }
                '?' => {
                    let mut out = self.alts(alts, next);
                    out.insert(0, next);
                    self.push(Node::Split(out))
                }
                '!' => {
                    let out = self.alts(alts, MATCH);
                    let sub = self.push(Node::Split(out));
                    self.push(Node::Neg { sub, next })
                }
                _ => {
                    // * and +: loop back after each match
                    let after = self.push(Node::Split(Vec::new()));
                    let out = self.alts(alts, after);
                    let entry = self.push(Node::Split(out));
                    self.nodes[after] = Node::Split(vec![next, entry]);
                    if ty == '*' {
                        after
                    } else {
                        entry
                    }
                }
            }
        }
    }

    /// The threads at one position in the string. Each node thread is kept once, and each run
    /// with the same state once, so identical threads merge.
    #[derive(Clone)]
    struct State {
        /// Marks the nodes this state has, in `Sim::has` and `Sim::seen`.
        gen: usize,
        threads: Vec<usize>,
        matched: bool,
        runs: Vec<Run>,
        /// The sorted thread ids, with `MATCH` for a match, once the state is done.
        ids: Vec<usize>,
    }

    impl State {
        /// No threads, so nothing more can match.
        fn dead(&self) -> bool {
            self.threads.is_empty() && !self.matched && self.runs.is_empty()
        }
    }

    /// A thread inside a `!(...)`: the threads of its sub-pattern, from where the negation
    /// started.
    #[derive(Clone)]
    struct Run {
        neg: usize,
        state: State,
    }

    fn same_state(a: &State, b: &State) -> bool {
        if a.ids != b.ids || a.runs.len() != b.runs.len() {
            return false;
        }
        for r in &a.runs {
            if !has_run(&b.runs, r) {
                return false;
            }
        }
        true
    }

    fn has_run(runs: &[Run], run: &Run) -> bool {
        for r in runs {
            if r.neg == run.neg && same_state(&r.state, &run.state) {
                return true;
            }
        }
        false
    }

    /// ponytail: no `Dfa` cache of the states; each test walks the machine.
    struct Sim<'a> {
        nodes: &'a [Node],
        /// `.` and `..` only match literal dots, even with `dot`.
        dots: bool,
        /// The string starts with `.`, without `dot`.
        dot_start: bool,
        /// For each node, the gen of the last state with it as a thread, and of the last state
        /// that walked through it. A state is built to the end before the ones around it go on,
        /// and a sub-pattern's nodes are only in its own states.
        has: Vec<usize>,
        seen: Vec<usize>,
        gen: usize,
    }

    impl Sim<'_> {
        fn state(&mut self) -> State {
            self.gen += 1;
            State {
                gen: self.gen,
                threads: Vec::new(),
                matched: false,
                runs: Vec::new(),
                ids: Vec::new(),
            }
        }

        fn done(&self, mut state: State) -> State {
            state.ids = state.threads.clone();
            state.ids.sort_unstable();
            if state.matched {
                state.ids.insert(0, MATCH);
            }
            state
        }

        /// Wildcards only match a leading dot with `dot`. Inside a negation they can, because
        /// the negation itself can't match it.
        fn restricted(&self, i: usize, top: bool) -> bool {
            top && (self.dots || (self.dot_start && i == 0))
        }

        /// `sim.add(state, node, i, top)`, with a stack: the threads `node` leads to without a
        /// char.
        fn add(&mut self, state: &mut State, node: usize, i: usize, top: bool) {
            let nodes = self.nodes;
            let mut stack = vec![node];
            while let Some(n) = stack.pop() {
                match &nodes[n] {
                    Node::Split(out) => {
                        if self.visit(state, n) {
                            stack.extend(out.iter().rev());
                        }
                    }
                    Node::Neg { sub, next } => {
                        if !self.visit(state, n) {
                            continue;
                        }
                        let mut s = self.state();
                        self.add(&mut s, *sub, i, false);
                        let run = Run {
                            neg: n,
                            state: self.done(s),
                        };
                        if self.add_run(state, run) {
                            stack.push(*next);
                        }
                    }
                    // A `*` can't start a dotfile, even when it matches nothing.
                    Node::Star(next) => {
                        if !self.restricted(i, top) && self.add_thread(state, n) {
                            stack.push(*next);
                        }
                    }
                    Node::Match => state.matched = true,
                    _ => {
                        self.add_thread(state, n);
                    }
                }
            }
        }

        /// `addRun`, without adding the threads after the negation: `true` if they follow,
        /// because its sub-pattern doesn't match.
        fn add_run(&mut self, state: &mut State, run: Run) -> bool {
            if has_run(&state.runs, &run) {
                return false;
            }
            let follows = !run.state.matched;
            state.runs.push(run);
            follows
        }

        /// `sim.step(state, c, i, top)`: the threads after char `c`, at index `i`.
        fn step(&mut self, state: &State, c: char, i: usize, top: bool) -> State {
            let nodes = self.nodes;
            let mut next = self.state();
            let restricted = self.restricted(i, top);
            for &th in &state.threads {
                let to = match &nodes[th] {
                    Node::Lit(l, to) if *l == c => *to,
                    Node::Any(to) if !restricted => *to,
                    Node::Class(class, to) if !restricted && class.has(c) => *to,
                    Node::Star(_) if !restricted => th,
                    _ => continue,
                };
                self.add(&mut next, to, i + 1, top);
            }
            if !restricted {
                for run in &state.runs {
                    // a sub-pattern with no threads can't match again, so the run stays
                    let run = if run.state.dead() {
                        run.clone()
                    } else {
                        Run {
                            neg: run.neg,
                            state: self.step(&run.state, c, i, false),
                        }
                    };
                    let Node::Neg { next: to, .. } = nodes[run.neg] else {
                        unreachable!("a run of a node that isn't a negation")
                    };
                    if self.add_run(&mut next, run) {
                        self.add(&mut next, to, i + 1, top);
                    }
                }
            }
            self.done(next)
        }

        /// `true` the first time the state walks through the node, so loops stop.
        fn visit(&mut self, state: &State, node: usize) -> bool {
            if self.seen[node] == state.gen {
                return false;
            }
            self.seen[node] = state.gen;
            true
        }

        fn add_thread(&mut self, state: &mut State, node: usize) -> bool {
            if self.has[node] == state.gen {
                return false;
            }
            self.has[node] = state.gen;
            state.threads.push(node);
            true
        }
    }

    /// parse-class.js `parseClass(glob, position)`: a class that tests one char.
    #[derive(Clone, Default)]
    struct Class {
        negate: bool,
        ranges: Vec<(char, char)>,
        /// Posix classes, by index in `POSIX`, with the ranges and the negated ones.
        posix: Vec<usize>,
        negs: Vec<usize>,
        /// `/$./`: an empty class, which matches nothing.
        never: bool,
    }

    /// The posix classes as Unicode properties, and whether they're negated.
    const POSIX: [(&str, &str, bool); 14] = [
        ("[:alnum:]", r"[\p{L}\p{Nl}\p{Nd}]", false),
        ("[:alpha:]", r"[\p{L}\p{Nl}]", false),
        ("[:ascii:]", r"[\x00-\x7f]", false),
        ("[:blank:]", r"[\p{Zs}\t]", false),
        ("[:cntrl:]", r"\p{Cc}", false),
        ("[:digit:]", r"\p{Nd}", false),
        ("[:graph:]", r"[\p{Z}\p{C}]", true),
        ("[:lower:]", r"\p{Ll}", false),
        ("[:print:]", r"\p{C}", true),
        ("[:punct:]", r"[\p{P}\p{S}]", false),
        ("[:space:]", r"[\p{Z}\t\r\n\v\f]", false),
        ("[:upper:]", r"\p{Lu}", false),
        ("[:word:]", r"[\p{L}\p{Nl}\p{Nd}\p{Pc}]", false),
        ("[:xdigit:]", r"[A-Fa-f0-9]", false),
    ];

    /// ponytail: the regex crate's Unicode tables stand in for V8's.
    static POSIX_RE: LazyLock<Vec<regex::Regex>> = LazyLock::new(|| {
        POSIX
            .iter()
            .map(|(_, re, _)| regex::Regex::new(&format!("^{re}$")).unwrap())
            .collect()
    });

    impl Class {
        fn has(&self, c: char) -> bool {
            if self.never {
                return false;
            }
            let posix = |k: &usize| POSIX_RE[*k].is_match(c.encode_utf8(&mut [0; 4]));
            let in_ranges = self.ranges.iter().any(|&(lo, hi)| lo <= c && c <= hi)
                || self.posix.iter().any(posix);
            let in_negs = self.negs.iter().any(posix);
            // `[ranges]` or `[^negs]`, the other way around when the class is negated
            let ranges = in_ranges != self.negate;
            let negs = in_negs == self.negate;
            match (
                !self.ranges.is_empty() || !self.posix.is_empty(),
                !self.negs.is_empty(),
            ) {
                (true, true) => ranges || negs,
                (true, false) => ranges,
                _ => negs,
            }
        }
    }

    /// `parseClass(glob, pos)`: the class and the chars it takes, or `None` if it isn't closed,
    /// so the `[` is literal. A class with nothing left in it takes the rest of the pattern, which
    /// then can't match.
    fn parse_class(glob: &[char], pos: usize) -> Option<(Class, usize)> {
        let starts_with = |s: &str, i: usize| {
            s.chars()
                .enumerate()
                .all(|(k, c)| glob.get(i + k) == Some(&c))
        };
        let never = Class {
            never: true,
            ..Class::default()
        };
        let mut class = Class::default();
        let mut i = pos + 1;
        let mut saw_start = false;
        let mut escaping = false;
        let mut end_pos = pos;
        let mut range_start: Option<char> = None;
        'chars: while i < glob.len() {
            let c = glob[i];
            if (c == '!' || c == '^') && i == pos + 1 {
                class.negate = true;
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
                for (k, (name, _, negated)) in POSIX.iter().enumerate() {
                    if starts_with(name, i) {
                        // [a-[] is fine, [a-[:alpha:]] isn't
                        if range_start.is_some() {
                            return Some((never, glob.len() - pos));
                        }
                        i += name.len();
                        if *negated {
                            class.negs.push(k);
                        } else {
                            class.posix.push(k);
                        }
                        continue 'chars;
                    }
                }
            }
            escaping = false;
            if let Some(lo) = range_start.take() {
                // An out of order range is dropped.
                if c >= lo {
                    class.ranges.push((lo, c));
                }
                i += 1;
                continue;
            }
            if starts_with("-]", i + 1) {
                class.ranges.push((c, c));
                class.ranges.push(('-', '-'));
                i += 2;
                continue;
            }
            if starts_with("-", i + 1) {
                range_start = Some(c);
                i += 2;
                continue;
            }
            class.ranges.push((c, c));
            i += 1;
        }
        if end_pos < i {
            return None;
        }
        if class.ranges.is_empty() && class.posix.is_empty() && class.negs.is_empty() {
            return Some((never, glob.len() - pos));
        }
        Some((class, end_pos - pos))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// minimatch.json has the answers of the minimatch theme-check-common uses on a grid of paths
    /// and patterns: `cases` with default options, `dotCases` with `{ dot: true }`. Each case is a
    /// pattern and the indexes of the paths it matches. `scripts/generate-minimatch-json.js`
    /// writes it.
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
        for (key, dot) in [("cases", false), ("dotCases", true)] {
            for case in v[key].as_array().unwrap() {
                let pattern = case[0].as_str().unwrap();
                let want: Vec<&str> = case[1]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|i| paths[i.as_u64().unwrap() as usize])
                    .collect();
                let mm = Minimatch::with_options(pattern, Options { dot });
                let got: Vec<&str> = paths.iter().copied().filter(|p| mm.matches(p)).collect();
                if got != want {
                    bad.push(format!("{key} {pattern:?}: node {want:?}, rust {got:?}"));
                }
            }
        }
        assert!(bad.is_empty(), "{}", bad.join("\n"));
    }

    /// The patterns minimatch throws on match nothing, and deep ones don't overflow the stack.
    /// For 1,000 levels of braces, a debug build needs more than the 2 MB of a test thread;
    /// release builds need less than 1 MB.
    #[test]
    fn limits() {
        let deep = || {
            let stars = |n: usize| format!("a{}", "*".repeat(n));
            assert!(minimatch("a", &stars(64 * 1024 - 1)));
            assert!(!minimatch("a", &stars(64 * 1024)));
            let negs = |n: usize| format!("a{}x{}", "!(".repeat(n), ")".repeat(n));
            assert!(minimatch("ax", &negs(256)));
            assert!(!minimatch("ay", &negs(256)));
            assert!(!minimatch("ax", &negs(257)));
            assert!(!minimatch("ay", &format!("!{}", negs(257))));
            assert!(minimatch("xx", &format!("{}x", "?(x)*".repeat(256))));
            assert!(!minimatch("xx", &format!("{}x", "?(x)*".repeat(257))));
            // JS runs out of stack on this one.
            assert!(minimatch("x", &format!("@(x){}", "*".repeat(60_000))));
            // `mergeRows` leaves the rows when the merged portion would have too many extglobs.
            let rows = format!("{{{},{}}}", "?(a)".repeat(200), "?(b)".repeat(100));
            assert!(minimatch("aa", &rows));
            assert!(minimatch("bb", &rows));
            // `mergeRows` makes `@(*aa…|*ab…|…)`, which is too long past 12 sets.
            let merged = |n: usize| format!("*{}", "{a,b}".repeat(n));
            assert!(minimatch(&"a".repeat(12), &merged(12)));
            assert!(!minimatch(&"a".repeat(13), &merged(13)));
            assert!(!minimatch("b", &format!("!{}", merged(13))));
            let braces = |n: usize| format!("{}a,b{}", "{".repeat(n), "}".repeat(n));
            assert_eq!(brace_expand(&braces(1_001)).len(), 2);
            assert_eq!(brace_expand(&braces(1_100)), [braces(1_100)]);
        };
        let thread = std::thread::Builder::new().stack_size(16 << 20);
        thread.spawn(deep).unwrap().join().unwrap();
    }

    /// A padded range is one portion, of any width, on the stack of a test thread.
    #[test]
    fn padded_ranges() {
        let range = |zeros: usize| format!("{{{}1..100}}", "0".repeat(zeros));
        let digits = |n: usize, s: &str| format!("{}{s}", "0".repeat(n - s.len()));
        assert!(minimatch(&digits(3_001, "100"), &range(3_000)));
        assert!(minimatch(&digits(3_001, "1"), &range(3_000)));
        assert!(!minimatch(&digits(3_001, "101"), &range(3_000)));
        assert!(!minimatch("100", &range(3_000)));
        // JS runs out of stack on these.
        assert!(minimatch(&digits(60_001, "42"), &range(60_000)));
        assert!(!minimatch(&digits(60_000, "42"), &range(60_000)));
    }
}
