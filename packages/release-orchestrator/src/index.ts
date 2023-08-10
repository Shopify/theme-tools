import { flow } from './utils';
import { buildReleasePipeline } from './build-release-pipeline';

const args = process.argv.slice(2);
const releasePipeline = buildReleasePipeline(args);
const startRelease = flow(releasePipeline);

startRelease();
