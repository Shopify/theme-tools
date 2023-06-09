import { check, themeCheckRun } from './index';
import path from 'node:path';

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2]);
  const { config, offenses } = await themeCheckRun(root);
  // console.log(JSON.stringify(offenses, null, 2));
  // console.log(JSON.stringify(config.settings, null, 2));
}

main();
