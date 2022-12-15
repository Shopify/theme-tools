import { check } from './index';

async function main(): Promise<void> {
  const root = process.argv[2];
  const offenses = await check(root);
  console.log(JSON.stringify(offenses, null, 2));
}

main();
