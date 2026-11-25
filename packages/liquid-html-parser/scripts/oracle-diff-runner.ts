// This runs as a vitest test to leverage the existing build
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { toLiquidHtmlAST, toLiquidAST } from "../src/ast";
import { nonTraversableProperties } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, "fixtures", "theme");
const GOLDEN_HTML_AST_DIR = resolve(__dirname, "fixtures", "golden-html-ast");
const GOLDEN_LIQUID_AST_DIR = resolve(__dirname, "fixtures", "golden-liquid-ast");

function stripAST(ast: any): any {
  return JSON.parse(
    JSON.stringify(ast, (key, value) => {
      if (key === "source" || key === "_source") return undefined;
      if (nonTraversableProperties.has(key)) return undefined;
      if (
        [
          "locStart",
          "locEnd",
          "conditions",
          "renderArguments",
          "sectionName",
          "blockName",
          "blockStartLocStart",
          "blockStartLocEnd",
          "blockEndLocStart",
          "blockEndLocEnd",
          "attrList",
        ].includes(key)
      )
        return undefined;
      return value;
    }),
  );
}

function findLiquidFiles(dir: string, prefix = ""): { path: string; fullPath: string }[] {
  const results: { path: string; fullPath: string }[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...findLiquidFiles(join(dir, entry.name), relPath));
    } else if (entry.name.endsWith(".liquid")) {
      results.push({ path: relPath, fullPath: join(dir, entry.name) });
    }
  }
  return results;
}

function goldenFileName(relativePath: string): string {
  return relativePath.replace(/\//g, "-") + ".json";
}

function deepDiff(expected: any, actual: any, path = ""): any[] {
  const diffs: any[] = [];
  if (expected === actual) return diffs;
  if (expected === null || actual === null || typeof expected !== typeof actual) {
    diffs.push({ path, type: "value", expected, actual });
    return diffs;
  }
  if (typeof expected !== "object") {
    diffs.push({ path, type: "value", expected, actual });
    return diffs;
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      diffs.push({ path, type: "array_length", expected: expected.length, actual: actual.length });
    }
    const len = Math.min(expected.length, actual.length);
    for (let i = 0; i < len; i++) {
      diffs.push(...deepDiff(expected[i], actual[i], `${path}[${i}]`));
    }
    for (let i = len; i < expected.length; i++) {
      diffs.push({ path: `${path}[${i}]`, type: "missing", expected: expected[i] });
    }
    for (let i = len; i < actual.length; i++) {
      diffs.push({ path: `${path}[${i}]`, type: "extra", actual: actual[i] });
    }
    return diffs;
  }
  const allKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of allKeys) {
    if (!(key in expected)) {
      diffs.push({ path: `${path}.${key}`, type: "extra_key", actual: actual[key] });
    } else if (!(key in actual)) {
      diffs.push({ path: `${path}.${key}`, type: "missing_key", expected: expected[key] });
    } else {
      diffs.push(...deepDiff(expected[key], actual[key], `${path}.${key}`));
    }
  }
  return diffs;
}

const THEMES = ["base-theme", "dawn", "horizon"];
const results: any[] = [];

for (const theme of THEMES) {
  const themeDir = join(FIXTURES_DIR, theme);
  const files = findLiquidFiles(themeDir);

  for (const { path, fullPath } of files) {
    const source = readFileSync(fullPath, "utf-8");

    const goldenHtmlPath = join(GOLDEN_HTML_AST_DIR, theme, goldenFileName(path));
    if (existsSync(goldenHtmlPath)) {
      try {
        const ast = toLiquidHtmlAST(source);
        const stripped = stripAST(ast);
        const golden = JSON.parse(readFileSync(goldenHtmlPath, "utf-8"));
        const diffs = deepDiff(golden, stripped);
        if (diffs.length > 0) {
          results.push({
            fixture: `${theme}/${path}`,
            mode: "html",
            diffCount: diffs.length,
            firstDiffs: diffs.slice(0, 5),
          });
        }
      } catch (e: any) {
        results.push({
          fixture: `${theme}/${path}`,
          mode: "html",
          error: e.message?.slice(0, 200),
        });
      }
    }

    const goldenLiquidPath = join(GOLDEN_LIQUID_AST_DIR, theme, goldenFileName(path));
    if (existsSync(goldenLiquidPath)) {
      try {
        const ast = toLiquidAST(source);
        const stripped = stripAST(ast);
        const golden = JSON.parse(readFileSync(goldenLiquidPath, "utf-8"));
        const diffs = deepDiff(golden, stripped);
        if (diffs.length > 0) {
          results.push({
            fixture: `${theme}/${path}`,
            mode: "liquid",
            diffCount: diffs.length,
            firstDiffs: diffs.slice(0, 5),
          });
        }
      } catch (e: any) {
        results.push({
          fixture: `${theme}/${path}`,
          mode: "liquid",
          error: e.message?.slice(0, 200),
        });
      }
    }
  }
}

writeFileSync("/tmp/oracle-diffs.json", JSON.stringify(results, null, 2));
console.log(`Total failing: ${results.length}`);
console.log(`HTML failures: ${results.filter((r: any) => r.mode === "html").length}`);
console.log(`Liquid failures: ${results.filter((r: any) => r.mode === "liquid").length}`);
console.log(`Parse errors: ${results.filter((r: any) => r.error).length}`);
