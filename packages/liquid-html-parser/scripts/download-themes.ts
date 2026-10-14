/**
 * Download theme .liquid files from GitHub into fixtures/theme/.
 *
 * Usage: pnpx tsx scripts/download-themes.ts [--refs-file <path>] [--themes dawn,horizon]
 *
 * Downloads Dawn, Horizon, and base-theme (ose-next-theme) from their
 * GitHub repos using `gh api` to fetch tarballs. Extracts only .liquid
 * files, preserving directory structure.
 *
 * Every theme is fetched by commit SHA, never by a moving ref:
 * - `--refs-file <path>` pointing at an existing JSON map of theme name to SHA
 *   fetches exactly those SHAs.
 * - `--refs-file <path>` pointing at a missing file resolves each theme's HEAD
 *   to a SHA, fetches that SHA, and writes the map to the path.
 * - Without `--refs-file`, HEAD is resolved to a SHA and nothing is written.
 *
 * `--themes` selects a comma-separated subset of themes by name.
 *
 * The fetched SHAs are recorded in fixtures/theme/manifest.json. A theme is
 * extracted into a temp dir and only replaces the existing dir on success,
 * and the script exits non-zero if any selected theme fails.
 */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures", "theme");
const MANIFEST_FILE = path.join(FIXTURES_DIR, "manifest.json");
const SHA_PATTERN = /^[0-9a-f]{40}$/;

interface ThemeSource {
  name: string;
  repo: string;
  ref?: string; // branch or tag, defaults to HEAD
  /** Subdirectory within the repo to extract (e.g., 'templates' extracts only that folder). Empty = root. */
  dirs: string[];
}

interface ManifestEntry {
  theme: string;
  repo: string;
  sha: string;
}

interface CliArgs {
  refsFile?: string;
  themes?: string[];
}

const THEMES: ThemeSource[] = [
  {
    name: "dawn",
    repo: "Shopify/dawn",
    dirs: ["layout", "templates", "sections", "snippets", "blocks"],
  },
  {
    name: "horizon",
    repo: "Shopify/horizon",
    dirs: ["layout", "templates", "sections", "snippets", "blocks"],
  },
  {
    name: "base-theme",
    repo: "shopify-playground/ose-next-theme",
    dirs: ["layout", "templates", "sections", "snippets", "blocks"],
  },
];

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--refs-file" && value) {
      args.refsFile = path.resolve(value);
      i++;
      continue;
    }
    if (flag === "--themes" && value) {
      args.themes = value.split(",").map((name) => name.trim()).filter(Boolean);
      i++;
      continue;
    }
    throw new Error(`Unknown or incomplete argument: ${flag}`);
  }
  return args;
}

function selectThemes(names: string[] | undefined): ThemeSource[] {
  if (!names) return THEMES;
  const unknown = names.filter((name) => !THEMES.some((theme) => theme.name === name));
  if (unknown.length > 0) {
    throw new Error(`Unknown theme(s): ${unknown.join(", ")}. Known: ${THEMES.map((t) => t.name).join(", ")}`);
  }
  return THEMES.filter((theme) => names.includes(theme.name));
}

function readRefsFile(refsFile: string): Record<string, string> {
  const refs = JSON.parse(fs.readFileSync(refsFile, "utf-8"));
  if (typeof refs !== "object" || refs === null || Array.isArray(refs)) {
    throw new Error(`${refsFile} must be a JSON object of theme name to commit SHA`);
  }
  return refs;
}

function resolveSha(theme: ThemeSource): string {
  const ref = theme.ref || "HEAD";
  const sha = execSync(`gh api repos/${theme.repo}/commits/${ref} --jq .sha`, {
    stdio: ["pipe", "pipe", "pipe"],
  })
    .toString()
    .trim();
  if (!SHA_PATTERN.test(sha)) {
    throw new Error(`Could not resolve ${theme.repo}@${ref} to a commit SHA (got "${sha}")`);
  }
  return sha;
}

function pinnedSha(theme: ThemeSource, refs: Record<string, string> | undefined): string {
  if (!refs) return resolveSha(theme);
  const sha = refs[theme.name];
  if (typeof sha !== "string" || !SHA_PATTERN.test(sha)) {
    throw new Error(`Refs file has no valid 40-char SHA for ${theme.name} (got ${JSON.stringify(sha)})`);
  }
  return sha;
}

// GitHub names the top-level dir <owner>-<repo>-<sha7> for public repos and
// <owner>-<repo>-<sha> for some private ones, so accept any SHA prefix of 7+ chars.
function tarballPrefixMatches(prefix: string, theme: ThemeSource, sha: string): boolean {
  const repoPart = `${theme.repo.replace("/", "-")}-`;
  if (!prefix.startsWith(repoPart)) return false;
  const shaPart = prefix.slice(repoPart.length);
  return shaPart.length >= 7 && sha.startsWith(shaPart);
}

function checkTarballPrefix(tmpTar: string, theme: ThemeSource, sha: string): void {
  const firstEntry = execSync(`tar -tzf "${tmpTar}" | head -1`, {
    stdio: ["pipe", "pipe", "pipe"],
  })
    .toString()
    .trim();
  const prefix = firstEntry.split("/")[0];
  if (!tarballPrefixMatches(prefix, theme, sha)) {
    const expected = `${theme.repo.replace("/", "-")}-${sha.slice(0, 7)}`;
    throw new Error(`Tarball prefix "${prefix}" does not match expected "${expected}"`);
  }
}

function extractLiquidFiles(tmpTar: string, theme: ThemeSource, outDir: string): void {
  // tar outputs files as <owner>-<repo>-<sha7>/<path>, so --strip-components=1 removes that
  for (const dir of theme.dirs) {
    try {
      execSync(
        `tar -xzf "${tmpTar}" --strip-components=1 -C "${outDir}" --include="*/${dir}/*.liquid" 2>/dev/null`,
        { stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch {
      // Directory might not exist in this theme — that's fine
    }
  }
}

function downloadTheme(theme: ThemeSource, sha: string): void {
  const outDir = path.join(FIXTURES_DIR, theme.name);
  const tmpDir = path.join(FIXTURES_DIR, `.tmp-${theme.name}`);
  const tmpTar = path.join(FIXTURES_DIR, `.tmp-${theme.name}.tar.gz`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log(`Downloading ${theme.repo} (${sha})...`);

  try {
    execSync(`gh api repos/${theme.repo}/tarball/${sha} > "${tmpTar}"`, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    checkTarballPrefix(tmpTar, theme, sha);
    extractLiquidFiles(tmpTar, theme, tmpDir);

    const files = findLiquidFiles(tmpDir);
    if (files.length === 0) {
      throw new Error(`No .liquid files extracted from ${theme.repo}@${sha}`);
    }

    fs.rmSync(outDir, { recursive: true, force: true });
    fs.renameSync(tmpDir, outDir);
    console.log(`  ${theme.name}: ${files.length} .liquid files`);
  } finally {
    fs.rmSync(tmpTar, { force: true });
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function findLiquidFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
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

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const themes = selectThemes(args.themes);
  const refsFileExists = !!args.refsFile && fs.existsSync(args.refsFile);
  const refs = refsFileExists ? readRefsFile(args.refsFile!) : undefined;

  console.log(`Downloading themes into ${FIXTURES_DIR}\n`);
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  const manifest: ManifestEntry[] = [];
  const failures: string[] = [];

  for (const theme of themes) {
    try {
      const sha = pinnedSha(theme, refs);
      downloadTheme(theme, sha);
      manifest.push({ theme: theme.name, repo: theme.repo, sha });
    } catch (e: any) {
      console.error(`  ERROR downloading ${theme.name}: ${e.message}`);
      console.error(`  Make sure you have access to ${theme.repo} and gh is authenticated.`);
      failures.push(theme.name);
    }
  }

  if (failures.length > 0) {
    console.error(`\nFailed: ${failures.join(", ")}. Manifest and refs file not written.`);
    process.exit(1);
  }

  writeJson(MANIFEST_FILE, manifest);

  if (args.refsFile && !refsFileExists) {
    writeJson(args.refsFile, Object.fromEntries(manifest.map((entry) => [entry.theme, entry.sha])));
    console.log(`Wrote resolved SHAs to ${args.refsFile}`);
  }

  const total = findLiquidFiles(FIXTURES_DIR).length;
  console.log(`\nDone. ${total} total .liquid files.`);
}

main();
