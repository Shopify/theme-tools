// Required: Mocha in browser context
require('mocha/mocha');

export function run(): Promise<void> {
  return new Promise((resolve, reject) => {
    mocha.setup({
      ui: 'tdd',
      reporter: undefined,
    });

    // Webpack require.context for test discovery
    const importAll = (r: __WebpackModuleApi.RequireContext) => r.keys().forEach(r);
    importAll(require.context('.', true, /\.test$/));

    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}
