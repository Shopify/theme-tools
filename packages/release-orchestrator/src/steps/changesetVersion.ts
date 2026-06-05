import { run } from '../utils';

export const changesetVersion = async () => {
  console.log('Running `changeset version`...');
  console.log(await run('pnpm exec changeset version'));

  console.log('Updating `pnpm-lock.yaml`...');
  console.log(await run('pnpm install --lockfile-only'));
};
