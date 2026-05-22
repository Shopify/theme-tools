import { run } from '../utils';

export const changesetTag = async () => {
  console.log('Creating git tags for package versions...');
  console.log(await run('pnpm exec changeset tag'));
};
