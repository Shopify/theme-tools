//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict';

const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

/** @type WebpackConfig */
const config = {
  target: 'node',
  entry: {
    extension: './src/extension.ts',
    server: './src/server.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]',
  },
  context: path.resolve(__dirname),
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded
    prettier: 'commonjs ./prettier',
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js'],
  },
  module: {
    parser: {
      javascript: {
        commonjsMagicComments: true,
      },
    },
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  devtool: 'source-map',
  plugins: [
    new webpack.DefinePlugin({
      // A flag that lets us do fun webpack-only shenanigans...
      'process.env.WEBPACK_MODE': true,
    }),
    new CopyPlugin({
      patterns: [
        {
          // The config/* yaml files need to be accessible from the VS Code
          // extension. So we copy them into the dist/configs folder so that
          // the __dirname eval can correctly load them. It's a bit hacky,
          // buit it works :)
          //
          // This is also why we have __dirname as 'eval-only'.
          from: path.resolve(__dirname, '../theme-check-node/configs'),
          to: 'configs',
        },
        {
          from: path.resolve(__dirname, '../../node_modules/prettier'),
          to: 'prettier',
        },
      ],
    }),
  ],
  node: {
    __filename: 'eval-only', // this means that __filename will eval to the output file name
    __dirname: 'eval-only', // this means that __dirname will eval to the dist folder
  },
  infrastructureLogging: {
    level: 'log', // enables logging required for problem matchers
  },
};
module.exports = [config];
