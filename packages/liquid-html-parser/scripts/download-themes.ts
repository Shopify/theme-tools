/**
 * Download theme .liquid files from GitHub into fixtures/theme/.
 *
 * Usage: pnpx tsx scripts/download-themes.ts
 *
 * Downloads Dawn, Horizon, and base-theme (ose-next-theme) from their
 * GitHub repos using `gh api` to fetch tarballs. Extracts only .liquid
 * files, preserving directory structure.
 */
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures", "theme");

interface ThemeSource {
  name: string;
  repo: string;
  ref?: string; // branch or tag, defaults to HEAD
  /** Subdirectory within the repo to extract (e.g., 'templates' extracts only that folder). Empty = root. */
  dirs: string[];
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

function downloadTheme(theme: ThemeSource): void {
  const outDir = path.join(FIXTURES_DIR, theme.name);

  // Clean existing
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const ref = theme.ref || "HEAD";
  console.log(`Downloading ${theme.repo} (${ref})...`);

  // Use gh to download tarball and extract .liquid files
  const tmpTar = path.join(FIXTURES_DIR, `${theme.name}.tar.gz`);
  try {
    execSync(`gh api repos/${theme.repo}/tarball/${ref} > "${tmpTar}"`, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Extract .liquid files, stripping the top-level directory prefix
    // tar outputs files as <repo>-<sha>/<path>, so --strip-components=1 removes that
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

    // Count extracted files
    const files = findLiquidFiles(outDir);
    console.log(`  ${theme.name}: ${files.length} .liquid files`);
  } finally {
    if (fs.existsSync(tmpTar)) fs.unlinkSync(tmpTar);
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

function main(): void {
  console.log(`Downloading themes into ${FIXTURES_DIR}\n`);

  for (const theme of THEMES) {
    try {
      downloadTheme(theme);
    } catch (e: any) {
      console.error(`  ERROR downloading ${theme.name}: ${e.message}`);
      console.error(`  Make sure you have access to ${theme.repo} and gh is authenticated.`);
    }
  }

  const total = findLiquidFiles(FIXTURES_DIR).length;
  console.log(`\nDone. ${total} total .liquid files.`);
}

main();
