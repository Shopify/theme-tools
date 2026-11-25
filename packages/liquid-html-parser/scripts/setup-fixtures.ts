/**
 * One-shot fixture setup: download themes, generate bundle, generate goldens.
 *
 * Usage: pnpx tsx scripts/setup-fixtures.ts
 *
 * Idempotent — safe to re-run. Each step overwrites its output.
 */
import { execSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(__dirname, "..");

function run(label: string, cmd: string): void {
  console.log(`\n── ${label} ──\n`);
  execSync(cmd, { cwd: PKG, stdio: "inherit" });
}

run("1. Download themes", "pnpx tsx scripts/download-themes.ts");
run("2. Generate theme bundle", "pnpx tsx scripts/generate-theme-bundle.ts");
run("3. Build parser", "pnpm build");
run("4. Generate golden fixtures", "pnpx tsx scripts/generate-golden.ts");

console.log("\n✓ Fixtures ready.\n");
