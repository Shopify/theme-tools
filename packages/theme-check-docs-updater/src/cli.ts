#!/usr/bin/env node

import fs from 'node:fs';
import { downloadThemeLiquidDocs, root, ThemeLiquidDocsManager } from '.';

// Get the command line arguments
const args = process.argv.slice(2);

// Check if a command was provided
if (args.length === 0) {
  console.log(`
Please provide a command.

Usage:
 download <dir> \t\tDownloads all docsets and JSON Schemas to the specified directory.
 dependencies \t\tPrints the up to date theme dependencies.
 root \tPrints the default docsets root directory.
 clear-cache \tClears the default docsets root directory.
`);
  process.exit(1);
}

async function main() {
  // Handle the command
  switch (args[0]) {
    case 'download':
      if (args.length > 2) {
        console.log('Please provide a directory to download docs into.');
        process.exit(1);
      }
      console.log('Downloading docs...');

      downloadThemeLiquidDocs(args[1], console.error.bind(console));

      break;

    case 'dependencies':
      // This command is used to print the current state of the docs.
      // It's a bit like what the webpack build of the fallback does in the browser VS Code extension.
      const docsManager = new ThemeLiquidDocsManager();
      const [tags, filters, objects, systemTranslations, schemas] = await Promise.all([
        docsManager.tags(),
        docsManager.filters(),
        docsManager.objects(),
        docsManager.systemTranslations(),
        docsManager.schemas('theme'), // assuming we want the theme JSON schema validation
      ]);
      console.log(
        JSON.stringify({
          tags,
          filters,
          objects,
          systemTranslations,
          schemas,
        }),
      );
      break;

    case 'root':
      console.log(root);
      break;

    case 'clear-cache':
      console.log(`Removing '${root}'`);
      fs.rmSync(root, { recursive: true });
      break;

    default:
      console.log(`Unknown command: ${args[0]}`);
      process.exit(1);
  }
}

main();
