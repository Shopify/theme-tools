import { buildReleasePipeline } from './build-release-pipeline';
import { flow } from './flow';

const main = async () => {
  const args = process.argv.slice(2);
  const releasePipeline = buildReleasePipeline(args);
  const startRelease = flow(releasePipeline);

  try {
    await startRelease();
  } catch (err) {
    process.exit(1);
  }
};

main();
