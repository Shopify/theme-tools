// Required: Mocha in browser context
require('mocha/mocha');

export async function run(): Promise<void> {
  // Debug delay: allows attaching debugger before tests run
  const delay = process.env.DEBUG_DELAY ? parseInt(process.env.DEBUG_DELAY, 10) : 0;
  if (delay > 0) {
    console.log(`[DEBUG] Waiting ${delay}ms for debugger attachment...`);
    await new Promise((r) => setTimeout(r, delay));
  }

  return new Promise((resolve, reject) => {
    mocha.setup({
      ui: 'tdd',
      reporter: undefined,
    });

    // Webpack require.context for test discovery
    const importAll = (r: any) => r.keys().forEach(r);
    importAll(require.context('.', true, /\.test$/));

    try {
      mocha.run((failures) => {
        // In watch mode, never resolve the promise so browser stays open
        if (process.env.WATCH_MODE) {
          console.log('[Watch Mode] Tests complete. Browser staying open. Refresh to re-run.');
          return; // Never resolve - browser stays open
        }

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
