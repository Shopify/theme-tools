#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const { downloadThemeLiquidDocs, root } = require(path.resolve(__dirname, '../dist'));

// Get the command line arguments
const args = process.argv.slice(2);

// Check if a command was provided
if (args.length === 0) {
  console.log(`
Please provide a command.

Usage:
 download <dir> \t\tDownloads all docsets and JSON Schemas to the specified directory.
 root \tPrints the default docsets root directory.
 clear-cache \tClears the default docsets root directory.
`);
  process.exit(1);
}

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
