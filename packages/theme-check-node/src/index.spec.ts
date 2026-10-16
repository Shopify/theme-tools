import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { Config, SourceCodeType, getTheme, getThemeFilesPathPattern, themeCheckRun } from './index';
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
  it('reports LiquidDoc errors across files when paths use Windows separators', async () => {
    const workspace = await makeTempWorkspace({
      locales: {
        'en.default.json': '{}',
      },
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
    });
    const originalRelative = path.relative;

    const relativeSpy = vi.spyOn(path, 'relative').mockImplementation((from, to) => {
      const relative = originalRelative(from, to);
      if (typeof from === 'string' && from.startsWith('file:')) {
        return relative.replace(/\//g, '\\');
      }
      return relative;
    });

    try {
      const { offenses } = await themeCheckRun(fileURLToPath(workspace.rootUri));
      expect(
        offenses.filter(({ check }) => check === 'MissingRenderSnippetArguments'),
      ).toHaveLength(1);
    } finally {
      relativeSpy.mockRestore();
      await workspace.clean();
    }
  });
});
