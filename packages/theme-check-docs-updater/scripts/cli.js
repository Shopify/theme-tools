#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const {
  ThemeLiquidDocsManager,
  buildThemeLiquidDocsBundle,
  downloadThemeLiquidDocs,
  root,
} = require(path.resolve(__dirname, '../dist'));

// Get the command line arguments
const args = process.argv.slice(2);

function printUsage() {
  console.log(`
Please provide a command.

Usage:
 download <dir> \t\tDownloads all docsets and JSON Schemas to the specified directory.
 bundle \t\t\tPrints a self-contained Liquid docs JSON bundle.
 root \tPrints the default docsets root directory.
 clear-cache \tClears the default docsets root directory.
`);
}

async function main() {
  // Check if a command was provided
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  // Handle the command
  switch (args[0]) {
    case 'download':
      if (args.length > 2) {
        console.error('Please provide a directory to download docs into.');
        process.exit(1);
      }
      console.log('Downloading docs...');

      await downloadThemeLiquidDocs(args[1], console.error.bind(console));

      break;

    case 'bundle': {
      if (args.length > 1) {
        console.error('The bundle command does not accept arguments.');
        process.exit(1);
      }

      const docsManager = new ThemeLiquidDocsManager(console.error.bind(console));
      const bundle = await buildThemeLiquidDocsBundle(docsManager);
      process.stdout.write(`${JSON.stringify(bundle)}\n`);

      break;
    }

    case 'root':
      console.log(root);
      break;

    case 'clear-cache':
      console.log(`Removing '${root}'`);
      fs.rmSync(root, { recursive: true, force: true });
      break;

    default:
      console.error(`Unknown command: ${args[0]}`);
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
