//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { default: TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');

/** @type {() => Promise<WebpackConfig>} */
const config = async () => {
  const devServerConfig = {
    devServer: {
      port: 3000,
      open: false,
      devMiddleware: {
        writeToDisk: true,
      },
    },
  };

  return {
    ...devServerConfig,
    context: __dirname,
    mode: 'development',
    entry: {
      playground: './src/playground.ts',
      'service-worker': './src/service-worker.ts',
    },
    output: {
      path: path.join(path.resolve(__dirname), 'dist'),
      filename: '[name].bundle.js',
      clean: true,
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: 'Output Management',
        template: path.join(path.resolve(__dirname), 'src/index.html'),
        chunks: ['playground'],
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
