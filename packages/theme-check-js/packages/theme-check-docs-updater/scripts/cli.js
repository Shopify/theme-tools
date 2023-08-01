#!/usr/bin/env node

const path = require('path');
const { downloadThemeLiquidDocs, compileJsonSchemaToFile } = require(path.resolve(
  __dirname,
  '../dist',
));

// Get the command line arguments
const args = process.argv.slice(2);

// Check if a command was provided
if (args.length === 0) {
  console.log(`
Please provide a command.

Acceptable values:
 download <DIR> \t\tDownloads all appropriate documentation and JSON Schemas from theme-liquid-docs.
 compile-json-schemas <DIR> \tCompiles JSON schemas in the specified directory. 
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

    downloadThemeLiquidDocs(args[1]);

    break;
  case 'compile-json-schemas':
    if (args.length > 2) {
      console.log('Please provide a directory to compile json schemas from.');
      process.exit(1);
    }
    console.log('Compiling JSON schemas...');

    compileJsonSchemaToFile(args[1]);

    break;
  default:
    console.log(`Unknown command: ${args[0]}`);
    process.exit(1);
}
