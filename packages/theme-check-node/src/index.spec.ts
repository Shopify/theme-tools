import { afterEach, assert, beforeEach, describe, expect, it } from 'vitest';
import { Config, SourceCodeType, getTheme } from './index';
import { Workspace, makeTempWorkspace } from './test/test-helpers';

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

    // explicitly normalize URI for cross-platform compatibility
    const expectedUri = workspace.uri('locales/en.default.json').replace(/\\/g, '/');
    expect(jsonFile.uri).to.equal(expectedUri);
  });
});
