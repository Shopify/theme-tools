import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import {
  Config,
  Offense,
  SourceCodeType,
  getTheme,
  getThemeFilesPathPattern,
  themeCheckRun,
} from './index';
import { Workspace, makeTempWorkspace } from './test/test-helpers';
import { fileURLToPath, pathToFileURL } from 'node:url';

describe('Unit: getTheme', () => {
  let workspace: Workspace;

  beforeEach(async () => {
    workspace = await makeTempWorkspace({
      locales: {
        'en.default.json': '{}',
      },
      snippets: {
        'header.liquid': '',
      },
    });
  });

  afterEach(async () => {
    await workspace.clean();
  });

  it('should correctly get theme on all platforms', async () => {
    const config: Config = {
      context: 'theme',
      checks: [],
      rootUri: workspace.rootUri,
      settings: {},
    };

    const theme = await getTheme(config);
    expect(theme).to.have.lengthOf(2);
    const jsonFile = theme.find((sc) => sc.type === SourceCodeType.JSON);
    assert(jsonFile);

    // internally we expect the path to be normalized
    expect(jsonFile.uri).to.equal(workspace.uri('locales/en.default.json').replace(/\\/g, '/'));
  });
});

describe('Unit: getThemeFilesPathPattern', () => {
  // This is mostly just to catch edge cases in Windows paths. We want
  // to ensure that paths do not start with a leading slash on Windows.
  it('should correctly format the glob pattern', () => {
    const rootUri = pathToFileURL(__dirname);
    const normalizedGlob = getThemeFilesPathPattern(rootUri.toString());

    expect(normalizedGlob).to.equal(__dirname.replace(/\\/g, '/') + '/**/*.{liquid,json}');
  });
});

describe('Integration: themeCheckRun', () => {
  const theme = {
    sections: {
      'main.liquid': "{% render 'card' %}",
    },
    snippets: {
      'card.liquid': `
        {% doc %}
          @param {string} title - The card title
        {% enddoc %}
      `,
    },
  };

  const missingArguments = (offenses: Offense[]) =>
    offenses.filter(({ check }) => check === 'MissingRenderSnippetArguments');

  it('reports cross-file LiquidDoc errors when the root path has a space', async () => {
    const workspace = await makeTempWorkspace(theme, path.join(os.tmpdir(), 'theme check.XXXXX'));
    try {
      const { offenses } = await themeCheckRun(fileURLToPath(workspace.rootUri));
      expect(missingArguments(offenses)).toHaveLength(1);
    } finally {
      await workspace.clean();
    }
  });

  it('reports cross-file LiquidDoc errors under the root set in the config', async () => {
    const workspace = await makeTempWorkspace({
      '.theme-check.yml': 'root: ./dist',
      dist: theme,
    });
    try {
      const { offenses } = await themeCheckRun(fileURLToPath(workspace.rootUri));
      expect(missingArguments(offenses)).toHaveLength(1);
    } finally {
      await workspace.clean();
    }
  });
});
