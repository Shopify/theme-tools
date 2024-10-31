import { spawn } from 'node:child_process';
import { generateMarkdown } from './generate-markdown';
import { getCurrentDateFormatted } from './get-current-date-formatted';
import { run } from './utils';
import type { StatusProperty } from './types';

const buildGithubPRLink = (branchName: string, title: string, description: string): string => {
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  if (encodedDescription.length > 2083) {
    console.log(
      'The PR description is too long to be included in the URL. The PR description has been placed in your clipboard.',
    );
    return `https://github.com/Shopify/theme-tools/compare/${branchName}?expand=1&title=${encodedTitle}`;
  } else {
    return `https://github.com/Shopify/theme-tools/compare/${branchName}?expand=1&title=${encodedTitle}&body=${encodedDescription}`;
  }
};

const noop = () => {};

export const finalMessaging = (branchName: string, statusProperty: StatusProperty) => () => {
  const prTitle = `Theme Tools Release: ${getCurrentDateFormatted()}`;
  const prDescription = generateMarkdown(statusProperty.value);
  const prLink = buildGithubPRLink(branchName, prTitle, prDescription);
  const message = `
All local work is done for this release!

Once the PR is approved, please do the following:
 - Merge with the 'Create a merge commit' option. This will ensure that the git tags correspond to the release commit hash.
 - Delete the release branch '${branchName}' after the merge is complete.
 - Deploy the updated packages on ShipIt: https://shipit.shopify.io/shopify/theme-tools/production
You may use this link to create the PR:

${prLink}
`;

  // Open the page automatically in your default browser. Why copy/paste
  // from terminal when you don't have to :)
  run(`open '${prLink}'`).then(noop, noop);

  // Copy the pr description to clipboard in case the pr description is too long
  spawn('pbcopy').stdin.end(prDescription);

  console.log(message);
};

export const initialMessaging = () => {
  const message = `
The release process for Theme Tools is about to begin.

This process will ask you a few questions along the way to create a release PR.
`;

  console.log(message);
};
