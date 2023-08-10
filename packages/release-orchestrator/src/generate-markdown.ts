import type { ChangesetStatus, Changeset } from './types';

const getChanges = (releaseName: string, changesets: Changeset[]) => {
  let markdown = '';
  const associatedChangesets = changesets.filter((changeset) =>
    changeset.releases.some((release) => release.name === releaseName),
  );

  if (associatedChangesets.length === 0) {
    return markdown;
  }

  markdown += `### Changes:\n`;
  associatedChangesets.forEach((changeset) => {
    markdown += `- ${changeset.summary}\n`;
  });

  return markdown;
};

const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Generates a markdown string detailing the changes made in each release.
 *
 * Uses the json output from `changeset status` as input.
 */
export const generateMarkdown = (status: ChangesetStatus): string => {
  let markdown = `# Releases\n`;

  status.releases.forEach((release) => {
    markdown += `## \`${release.name}\`\n`;
    markdown += `${capitalize(release.type)} incremented \`${release.oldVersion}\` -> \`${
      release.newVersion
    }\`\n`;
    markdown += getChanges(release.name, status.changesets);

    markdown += '\n';
  });

  return markdown;
};
