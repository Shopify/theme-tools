import { generateMarkdown } from './generate-markdown';
import { getCurrentDateFormatted } from './get-current-date-formatted';
import type { StatusProperty } from './types';

const buildGithubPRLink = (branchName: string, title: string, description: string): string => {
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  const url = `https://github.com/Shopify/theme-tools/compare/${branchName}?expand=1&title=${encodedTitle}&body=${encodedDescription}`;

  return url;
};

export const finalMessaging = (branchName: string, statusProperty: StatusProperty) => () => {
  const prTitle = `Theme Tools Release: ${getCurrentDateFormatted()}`;
  const prDescription = generateMarkdown(statusProperty.value);
  const message = `
All local work is done for this release!

Open the PR for reviews. Once the PR is approved and merged, all updated packages will be published to NPM.
You may use this link to create the PR:

${buildGithubPRLink(branchName, prTitle, prDescription)}
`;

  console.log(message);
};

export const initialMessaging = () => {
  const message = `
The release process for Theme Tools is about to begin.

This process will ask you a few questions along the way to create a release PR.
`;

  console.log(message);
};
