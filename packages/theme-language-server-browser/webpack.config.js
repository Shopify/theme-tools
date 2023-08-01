//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict';

const path = require('path');

/** @type WebpackConfig */
const config = {
  target: 'webworker',
  entry: './dist/index.js',
  output: {
    path: path.resolve(__dirname),
    filename: 'standalone.js',
    globalObject: 'self',
    library: {
      name: 'LiquidLanguageServer',
      type: 'umd',
    },
  },
  devtool: 'source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};
module.exports = [ config ];
