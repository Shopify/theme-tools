//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const { default: TsconfigPathsPlugin } = require('tsconfig-paths-webpack-plugin');
const path = require('path');
const { ThemeLiquidDocsManager } = require('@shopify/theme-check-docs-updater');

/** @type WebpackConfig */
const baseConfig = {
  context: path.resolve(__dirname),
  devServer: {
    port: 3000,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    plugins: [new TsconfigPathsPlugin({})],
  },
  optimization: {
    minimize: false,
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
        use: {
          loader: 'ts-loader',
          options: {
            projectReferences: true,
          },
        },
      },
    ],
  },
  devtool: 'source-map',
  node: {
    __filename: 'eval-only', // this means that __filename will eval to the output file name
    __dirname: 'eval-only', // this means that __dirname will eval to the dist folder
  },
  infrastructureLogging: {
    level: 'log', // enables logging required for problem matchers
  },
}

/** @type WebpackConfig */
const desktopConfig = {
  ...baseConfig,
  target: 'node',
  entry: {
    extension: './src/node/extension.ts',
    server: './src/node/server.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'node'),
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../../[resource-path]',
  },
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded
    prettier: 'commonjs ./prettier',
  },
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
          // Same deal but for the fallback docset and schema files.
          from: path.resolve(__dirname, '../theme-check-docs-updater/data'),
          to: 'data',
        },
        {
          from: path.resolve(__dirname, '../../node_modules/prettier'),
          to: 'prettier',
          globOptions: {
            ignore: ['**/esm/**'],
          },
        },
      ],
    }),
  ],
};

/** @type WebpackConfig */
const browserClientConfig = {
  ...baseConfig,
  target: 'webworker',
  entry: {
    extension: './src/browser/extension.ts',
    'test/suite/index': './src/browser/test/suite/index.ts',
  },
  resolve: {
    ...baseConfig.resolve,
    fallback: {
      assert: require.resolve('assert'),
      process: require.resolve('process/browser.js'),
    },
  },
  output: {
    path: path.resolve(__dirname, 'dist', 'browser'),
    filename: '[name].js',
    libraryTarget: 'commonjs',
    devtoolModuleFilenameTemplate: '../../[resource-path]',
  },
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
    }),
    new webpack.DefinePlugin({
      // A flag that lets us do fun webpack-only shenanigans...
      'process.env.WEBPACK_MODE': true,
    }),
  ],
};

const browserServerConfig = async () => {
  const docsManager = new ThemeLiquidDocsManager();
  const [tags, filters, objects, systemTranslations, schemas] = await Promise.all([
    docsManager.tags(),
    docsManager.filters(),
    docsManager.objects(),
    docsManager.systemTranslations(),
    docsManager.schemas('theme'),
  ]);

  return {
    ...baseConfig,
    target: 'webworker',
    entry: { server: './src/browser/server.ts', },
    output: {
      path: path.resolve(__dirname, 'dist', 'browser'),
      filename: '[name].js',
      libraryTarget: 'var',
      library: 'serverExportVar',
      devtoolModuleFilenameTemplate: '../../[resource-path]',
    },
    plugins: [
      new webpack.DefinePlugin({
        // A flag that lets us do fun webpack-only shenanigans...
        'process.env.WEBPACK_MODE': true,
        WEBPACK_TAGS: JSON.stringify(tags),
        WEBPACK_FILTERS: JSON.stringify(filters),
        WEBPACK_OBJECTS: JSON.stringify(objects),
        WEBPACK_SYSTEM_TRANSLATIONS: JSON.stringify(systemTranslations),
        WEBPACK_SCHEMAS: JSON.stringify(schemas),
      }),
    ],
  };
};

module.exports = [desktopConfig, browserClientConfig, browserServerConfig];
