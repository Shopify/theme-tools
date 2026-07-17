import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Usage: pnpx tsx scripts/generate-golden.ts [path-to-parser-module]
// Defaults to ../src/index (this package's source via tsx).
// Pass a dist path to use a different parser build.

const parserPath = process.argv[2] || path.resolve(__dirname, "..", "src", "index");
const { toLiquidHtmlAST, toLiquidAST } = await import(parserPath);

// nonTraversableProperties may not exist in older parser versions
let nonTraversableProperties: Set<string>;
try {
  const types = await import(parserPath.replace(/\/index$|\/index\.js$/, "/types"));
  nonTraversableProperties = types.nonTraversableProperties;
} catch {
  nonTraversableProperties = new Set(["parentNode", "prev", "next", "firstChild", "lastChild"]);
}

const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures", "theme");
const GOLDEN_HTML_DIR = path.resolve(__dirname, "..", "fixtures", "golden-html-ast");
const GOLDEN_LIQUID_DIR = path.resolve(__dirname, "..", "fixtures", "golden-liquid-ast");

const STRIPPED_KEYS = new Set([
  "source",
  "_source",
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
]);

function stripAST(ast: any): any {
  return JSON.parse(
    JSON.stringify(ast, (key, value) => {
      if (STRIPPED_KEYS.has(key)) return undefined;
      if (nonTraversableProperties.has(key)) return undefined;
      return value;
    }),
  );
}

function findLiquidFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findLiquidFiles(full));
    } else if (entry.name.endsWith(".liquid")) {
      results.push(full);
    }
  }
  return results;
}

function relToGoldenName(relPath: string): string {
  return relPath.replace(/\//g, "-") + ".json";
}

function main() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`Error: ${FIXTURES_DIR} does not exist.`);
    console.error("Populate fixtures/theme/ with .liquid files first (see fixtures/README.md).");
    process.exit(1);
  }

  const themes = fs.readdirSync(FIXTURES_DIR).filter((d) => {
    return fs.statSync(path.join(FIXTURES_DIR, d)).isDirectory();
  });

  if (themes.length === 0) {
    console.error(`Error: No theme directories found in ${FIXTURES_DIR}.`);
    console.error("Populate fixtures/theme/<theme-name>/ with .liquid files first.");
    process.exit(1);
  }

  const stats = {
    htmlSuccess: 0,
    htmlFail: 0,
    liquidSuccess: 0,
    liquidFail: 0,
    perTheme: {} as Record<
      string,
      { html: number; liquid: number; htmlFail: number; liquidFail: number }
    >,
  };

  for (const theme of themes) {
    const themeDir = path.join(FIXTURES_DIR, theme);
    const files = findLiquidFiles(themeDir);
    stats.perTheme[theme] = { html: 0, liquid: 0, htmlFail: 0, liquidFail: 0 };

    for (const file of files) {
      const relPath = path.relative(themeDir, file);
      const goldenName = relToGoldenName(relPath);
      const source = fs.readFileSync(file, "utf-8");

      // HTML AST
      try {
        const ast = toLiquidHtmlAST(source);
        const stripped = stripAST(ast);
        const outDir = path.join(GOLDEN_HTML_DIR, theme);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, goldenName), JSON.stringify(stripped, null, 2) + "\n");
        stats.htmlSuccess++;
        stats.perTheme[theme].html++;
      } catch (e: any) {
        stats.htmlFail++;
        stats.perTheme[theme].htmlFail++;
        console.error(`[HTML FAIL] ${theme}/${relPath}: ${e.message?.slice(0, 120)}`);
      }

      // Liquid AST
      try {
        const ast = toLiquidAST(source);
        const stripped = stripAST(ast);
        const outDir = path.join(GOLDEN_LIQUID_DIR, theme);
        fs.mkdirSync(outDir, { recursive: true });
        fs.writeFileSync(path.join(outDir, goldenName), JSON.stringify(stripped, null, 2) + "\n");
        stats.liquidSuccess++;
        stats.perTheme[theme].liquid++;
      } catch (e: any) {
        stats.liquidFail++;
        stats.perTheme[theme].liquidFail++;
        console.error(`[LIQUID FAIL] ${theme}/${relPath}: ${e.message?.slice(0, 120)}`);
      }
    }
  }

  console.log("\n=== Generation Summary ===");
  for (const theme of themes) {
    const t = stats.perTheme[theme];
    console.log(
      `${theme}: HTML ${t.html} ok / ${t.htmlFail} fail, Liquid ${t.liquid} ok / ${t.liquidFail} fail`,
    );
  }
  console.log(`\nTotal HTML: ${stats.htmlSuccess} ok / ${stats.htmlFail} fail`);
  console.log(`Total Liquid: ${stats.liquidSuccess} ok / ${stats.liquidFail} fail`);
}

main();
