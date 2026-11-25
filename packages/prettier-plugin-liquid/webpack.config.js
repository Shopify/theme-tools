const path = require('path');
const PRODUCTION = process.env.NODE_ENV === 'production';

module.exports = {
  entry: path.resolve(__dirname, 'dist', 'index.js'),
  mode: PRODUCTION ? 'production' : 'development',
  devtool: PRODUCTION ? undefined : 'inline-source-map',
  output: {
    filename: 'standalone.js',
    path: __dirname,
    globalObject: 'this',
    library: {
      name: 'prettierPluginLiquid',
      type: 'umd',
    },
  },
  externals: {
    // standalone.js is the browser build, so it loads prettier/standalone.
    // A bare 'prettier' resolves to Prettier 3's Node entry even in browser
    // bundles, because its "require" export comes before "browser".
    // `root` is the global that prettier/standalone.js sets in a <script> tag.
    prettier: {
      commonjs: 'prettier/standalone',
      commonjs2: 'prettier/standalone',
      amd: 'prettier/standalone',
      root: 'prettier',
    },
  },
  optimization: {
    minimize: PRODUCTION ? true : false,
  },
  node: {
    __dirname: true,
  },
};
