import { check, themeCheckRun } from './index';
import path from 'node:path';

async function main(): Promise<void> {
  const root = path.resolve(process.argv[2]);
  const configPath = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
  const { theme, config, offenses } = await themeCheckRun(root, configPath);
  console.log(JSON.stringify(offenses, null, 2));
  console.log(JSON.stringify(config, null, 2));
  console.log(
    JSON.stringify(
      theme.map((x) => x.absolutePath),
      null,
      2,
    ),
  );
}

main();
