import { expect, it, describe } from 'vitest';
import { generateMarkdown } from './generate-markdown';

describe('generateMarkdown', () => {
  it('should generate a markdown string detailing the changes made in each release', () => {
    const status = {
      releases: [
        { name: 'package1', type: 'patch', oldVersion: '1.0.0', newVersion: '1.0.1' },
        { name: 'package2', type: 'minor', oldVersion: '2.0.0', newVersion: '2.1.0' },
      ],
      changesets: [
        { summary: 'Fixed a bug in package1', releases: [{ name: 'package1', type: 'patch' }] },
        { summary: 'Added a feature to package2', releases: [{ name: 'package2', type: 'minor' }] },
      ],
    };

    const result = generateMarkdown(status);

    expect(result).toBe(
      `# Releases\n` +
        `## \`package1\`\n` +
        `Patch incremented \`1.0.0\` -> \`1.0.1\`\n` +
        `### Changes:\n` +
        `- Fixed a bug in package1\n` +
        `\n` +
        `## \`package2\`\n` +
        `Minor incremented \`2.0.0\` -> \`2.1.0\`\n` +
        `### Changes:\n` +
        `- Added a feature to package2\n` +
        `\n`,
    );
  });

  it('should generate a markdown string without changes section if there are no associated changesets', () => {
    const status = {
      releases: [{ name: 'package1', type: 'patch', oldVersion: '1.0.0', newVersion: '1.0.1' }],
      changesets: [],
    };

    const result = generateMarkdown(status);

    expect(result).toBe(
      `# Releases\n` + `## \`package1\`\n` + `Patch incremented \`1.0.0\` -> \`1.0.1\`\n` + `\n`,
    );
  });
});
