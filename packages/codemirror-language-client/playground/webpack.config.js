//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict';

const path = require('path');
const { DefinePlugin } = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { default: TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');
const { ThemeLiquidDocsManager } = require('@shopify/theme-check-docs-updater');

/** @type {() => Promise<WebpackConfig>} */
const config = async () => {
  const docsManager = new ThemeLiquidDocsManager();
  const [tags, filters, objects] = await Promise.all([
    docsManager.tags(),
    docsManager.filters(),
    docsManager.objects(),
  ]);

  return {
    context: __dirname,
    mode: 'development',
    entry: './src/playground.ts',
    output: {
      path: path.join(path.resolve(__dirname), 'dist'),
      filename: '[name].bundle.js',
      clean: true,
    },
    plugins: [
      new DefinePlugin({
        WEBPACK_TAGS: JSON.stringify(tags),
        WEBPACK_FILTERS: JSON.stringify(filters),
        WEBPACK_OBJECTS: JSON.stringify(objects),
      }),
      new HtmlWebpackPlugin({
        title: 'Output Management',
        template: path.join(path.resolve(__dirname), 'src/index.html'),
      }),
    ],
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.tsx?$/,
          use: {
            loader: 'ts-loader',
            options: {
              projectReferences: true,
            },
          },
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      plugins: [new TsconfigPathsPlugin({})],
    },
    devtool: 'source-map',
    infrastructureLogging: {
      level: 'log', // enables logging required for problem matchers
    },
  };
};
module.exports = [config];
