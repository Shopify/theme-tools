import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest';
import { Config, SourceCodeType, getTheme, getThemeFilesPathPattern } from './index';
import { Workspace, makeTempWorkspace } from './test/test-helpers';
import { pathToFileURL } from 'node:url';

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
