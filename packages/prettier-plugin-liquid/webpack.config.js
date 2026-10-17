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
    // The standalone bundle is browser-only. Downstream bundlers that consume
    // standalone.js (webpack, rollup, vite) see a UMD wrapper whose `commonjs`
    // and `commonjs2` branches `require('prettier')`. That import resolves to
    // prettier's Node-flavored main entry, which pulls in `module`, `url`, and
    // `path` and breaks browser builds. Route those branches to
    // `prettier/standalone` so downstream bundlers land on prettier's
    // browser-safe entry. `root: 'prettier'` is kept so <script>-tag loading
    // still works against the global `window.prettier` populated by
    // `prettier/standalone.js` on the page.
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
