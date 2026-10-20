#!/usr/bin/env bash
# Runs the root and prettier suites with the TS parser and then the Rust parser, and fails on any
# difference between the two. Then runs the browser differential and checks it parsed the same
# corpus as Node. The theme download needs an authenticated `gh` (GH_TOKEN in CI).
#
# Usage: packages/liquid-html-parser/scripts/ci-rust-parity.sh
# Reports go to $RUST_PARITY_OUT_DIR, or a new temp dir when it is unset.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PKG="$ROOT/packages/liquid-html-parser"
OUT="${RUST_PARITY_OUT_DIR:-$(mktemp -d)}"
mkdir -p "$OUT"
echo "Reports: $OUT"

PRETTIER_SCRIPTS=(test test:3 test:idempotence test:idempotence:3)
ALLOW_NEW=(
  --allow-new 'packages/liquid-html-parser/src/backend.test.ts'
  --allow-new 'packages/liquid-html-parser/src/rust-parity/**'
)

# generate-golden.ts uses top-level await, which `pnpx tsx` only runs as ESM, so run an .mts copy.
generate_goldens() (
  tmp="$PKG/scripts/.generate-golden.tmp.mts"
  trap 'rm -f "$tmp"' EXIT
  cp "$PKG/scripts/generate-golden.ts" "$tmp"
  cd "$PKG"
  pnpx tsx "$tmp"
)

run_suites() {
  local mode="$1"
  echo "== Root suite, LIQUID_PARSER=$mode"
  (cd "$ROOT" && LIQUID_PARSER="$mode" CI=1 pnpm exec vitest run \
    --reporter=default --reporter=json --outputFile.json="$OUT/root-$mode.json") |
    tee "$OUT/root-$mode.out"
  for script in "${PRETTIER_SCRIPTS[@]}"; do
    echo "== Prettier $script, LIQUID_PARSER=$mode"
    (cd "$ROOT" && LIQUID_PARSER="$mode" pnpm --dir packages/prettier-plugin-liquid "$script" \
      --reporter=default --reporter=json --outputFile.json="$OUT/prettier-${script//:/-}-$mode.json")
  done
}

oracle_count() {
  node -e '
    const report = require(process.argv[1]);
    const oracle = report.testResults.filter((f) => f.name.endsWith("parser-oracle.test.ts"));
    console.log(oracle.reduce((n, f) => n + f.assertionResults.length, 0));
  ' "$1"
}

require_oracle_tests() {
  local mode="$1"
  local count
  count="$(oracle_count "$OUT/root-$mode.json")"
  echo "Oracle tests, $mode: $count"
  [[ "$count" -gt 0 ]] && return 0
  echo "FAIL: the $mode root report has no oracle tests"
  return 1
}

compare_pair() {
  local name="$1"
  echo "== Compare $name, TS vs Rust"
  (cd "$PKG" && pnpx tsx scripts/compare-test-results.ts "${ALLOW_NEW[@]}" \
    "$OUT/$name-ts.json" "$OUT/$name-rust.json")
}

corpus_count() {
  local pattern="$1" file="$2"
  # vitest colours its output when CI is set, and the colour codes would defeat the ^ anchor.
  sed $'s/\x1b\\[[0-9;]*m//g' "$file" | grep -oE "^$pattern [0-9]+" | head -n 1 |
    grep -oE '[0-9]+$' || true
}

require_equal_corpus() {
  local node_count browser_count
  node_count="$(corpus_count 'Differential corpus:' "$OUT/root-rust.out")"
  browser_count="$(corpus_count 'Browser differential corpus:' "$OUT/browser.out")"
  echo "Node differential corpus: ${node_count:-missing}"
  echo "Browser differential corpus: ${browser_count:-missing}"
  [[ -n "$node_count" && "$node_count" == "$browser_count" ]] && return 0
  echo "FAIL: the Node and browser differential corpus counts differ"
  return 1
}

cd "$PKG"
pnpx tsx scripts/download-themes.ts --themes dawn,horizon --refs-file fixtures/theme-refs.json
pnpx tsx scripts/generate-theme-bundle.ts

cd "$ROOT"
pnpm build:ts
pnpm --dir packages/liquid-html-parser build:rust

generate_goldens

run_suites ts
run_suites rust

require_oracle_tests ts
require_oracle_tests rust

compare_pair root
for script in "${PRETTIER_SCRIPTS[@]}"; do
  compare_pair "prettier-${script//:/-}"
done

echo "== Browser differential"
# Name the reporter: under a coding agent vitest picks one that drops passing tests' logs.
(cd "$ROOT" && pnpm --dir packages/liquid-html-parser test:rust:browser --reporter=default) |
  tee "$OUT/browser.out"

require_equal_corpus

echo "Rust parity: PASS"
