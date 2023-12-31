import { getCurrentDateFormatted } from './get-current-date-formatted';
import { gitCommitChanges } from './git-commit-changes';
import type { ChangesetStatus, StatusProperty } from './types';

const generateCommitMessage = (changesetStatus: ChangesetStatus): string => {
  // Map each release to a string describing the package name, old version, new version, and type of change
  const releaseMessages = changesetStatus.releases.map((release) => {
    return `${release.name}: ${release.oldVersion} -> ${release.newVersion} (${release.type})`;
  });

  // Join all release messages into a single string with line breaks
  const commitTitle =
    `Release ${getCurrentDateFormatted()}: ` +
    `Updated ${changesetStatus.releases.length} package versions`;

  const commitDescription = releaseMessages.join('\n');

  return `${commitTitle}\n\n${commitDescription}`;
};
/**
 * Commits all changes to the packages and any other files that were modified during the release process.
 */
export const commitPackageVersionBumps = (statusProperty: StatusProperty) => async () => {
  const commitMsg = generateCommitMessage(statusProperty.value);

  return gitCommitChanges(commitMsg, [
    './packages/*',
    '--update', // This flag includes modifications such as deletions. ie: `changeset version` deleting changelogs.
  ])();
};
