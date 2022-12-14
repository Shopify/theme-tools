//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict';

const path = require('path');

/** @type WebpackConfig */
const config = {
  target: 'node',
  entry: './cli.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cli.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'source-map',
  infrastructureLogging: {
    level: "log", // enables logging required for problem matchers
  },
};
module.exports = [ config ];
