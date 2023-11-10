import { generateMarkdown } from './generate-markdown';
import { getCurrentDateFormatted } from './get-current-date-formatted';
import { run } from './utils';
import type { StatusProperty } from './types';

const buildGithubPRLink = (branchName: string, title: string, description: string): string => {
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const url = `https://github.com/Shopify/theme-tools/compare/${branchName}?expand=1&title=${encodedTitle}&body=${encodedDescription}`;

  return url;
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

  console.log(message);
};

export const initialMessaging = () => {
  const message = `
The release process for Theme Tools is about to begin.

This process will ask you a few questions along the way to create a release PR.
`;

  console.log(message);
};
