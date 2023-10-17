//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

/** @type WebpackConfig */
const config = {
  context: __dirname,
  mode: 'development',
  entry: './src/playground.ts',
  output: {
    path: path.join(path.resolve(__dirname), 'dist'),
    filename: '[name].bundle.js',
    clean: true,
  },
  plugins: [
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
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  devtool: 'source-map',
  infrastructureLogging: {
    level: 'log', // enables logging required for problem matchers
  },
};
module.exports = [config];
