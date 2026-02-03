//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const webpack = require('webpack');
const { default: TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');
const path = require('path');

/**
 * Webpack configuration for browser tests.
 * Separated from main webpack.config.js to isolate test-only dependencies (assert, process polyfills).
 *
 * @type WebpackConfig
 */
const browserTestConfig = {
  context: path.resolve(__dirname),
  mode: 'development',
  target: 'webworker',
  entry: {
    'test/suite/index': './test/browser/suite/index.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'browser'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../[resource-path]',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsPlugin({})],
    fallback: {
      assert: require.resolve('assert'),
      process: require.resolve('process/browser.js'),
    },
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
        include: path.resolve(__dirname, 'test'),
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'test', 'tsconfig.json'),
          },
        },
      },
      {
        test: /\.ts$/,
        exclude: [/node_modules/, path.resolve(__dirname, 'test')],
        use: {
          loader: 'ts-loader',
          options: {
            projectReferences: true,
          },
        },
      },
    ],
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
    }),
    new webpack.DefinePlugin({
      'process.env.WEBPACK_MODE': true,
      // @ohm-js/wasm checks this at runtime; define it to avoid "process is not defined" errors
      'process.env.OHM_DEBUG': JSON.stringify(false),
      'process.env.DEBUG_DELAY': JSON.stringify(process.env.DEBUG_DELAY || '0'),
      'process.env.WATCH_MODE': JSON.stringify(process.env.WATCH_MODE || ''),
    }),
  ],
  devtool: 'source-map',
  node: {
    __filename: 'eval-only',
    __dirname: 'eval-only',
  },
  infrastructureLogging: {
    level: 'log',
  },
};

module.exports = browserTestConfig;
