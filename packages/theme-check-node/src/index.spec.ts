import { describe, it, expect, assert, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
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
      checks: [],
      root: workspace.root,
      settings: {},
    };

    const theme = await getTheme(config);
    expect(theme).to.have.lengthOf(2);
    const jsonFile = theme.find((sc) => sc.type === SourceCodeType.JSON);
    assert(jsonFile);

    // internally we expect the path to be normalized
    expect(jsonFile.absolutePath).to.equal(
      workspace.path('locales/en.default.json').replace(/\\/g, '/'),
    );
  });
});
