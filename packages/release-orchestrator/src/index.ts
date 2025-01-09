import { changesetVersion } from './steps/changesetVersion';
import { getPackageJsonPaths } from './steps/getPackageJsonPaths';
import { getPackageJsonRecord } from './steps/getPackageJsonRecord';
import { writeDependentPatchChangesets } from './steps/writeDependentPatchChangesets';
import type { StepFunction } from './types';
import { flow } from './utils';

const main = async () => {
  const steps: StepFunction[] = [
    getPackageJsonPaths,
    getPackageJsonRecord,
    writeDependentPatchChangesets,
    changesetVersion,
  ];

  const startRelease = flow(steps);

  try {
    await startRelease();
  } catch (err) {
    process.exit(1);
  }
};

main();
