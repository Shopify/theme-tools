import { run } from '../utils';

export const changesetVersion = async () => {
  console.log('Running `changeset version`...');
  console.log(await run('yarn changeset version'));
};
