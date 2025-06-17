import {
  AbstractFileSystem,
  allChecks,
  LiquidCheckDefinition,
  path,
  Severity,
  SourceCodeType,
} from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Connection } from 'vscode-languageserver';
import { DocumentManager } from '../documents';
import { DiagnosticsManager } from './DiagnosticsManager';
import { makeRunChecks } from './runChecks';

const LiquidFilter: LiquidCheckDefinition = {
  meta: {
    code: 'LiquidFilter',
    name: 'Complains about every LiquidFilter',
    docs: {
      description: 'Complains about every LiquidFilter',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      LiquidFilter: async (node) => {
        context.report({
          message: 'Liquid filter can not be used',
          startIndex: node.position.start,
          endIndex: node.position.end,
        });
      },
    };
  },
};

describe('Module: runChecks', () => {
  let diagnosticsManager: DiagnosticsManager;
  let documentManager: DocumentManager;
  let connection: { sendDiagnostics: ReturnType<typeof vi.fn> };
  let runChecks: ReturnType<typeof makeRunChecks>;
  let fs: MockFileSystem;
  const rootUri = path.normalize('browser:///theme');
  const fileUri = path.join(rootUri, 'snippets', 'input.liquid');

  beforeEach(() => {
    connection = {
      sendDiagnostics: vi.fn(),
    };

    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager(connection as any as Connection);
    fs = new MockFileSystem(
      {
        '.theme-check.yml': '',
        'snippets/input.liquid': `{{ 'any' | filter }}`,
      },
      rootUri,
    );
    runChecks = makeRunChecks(documentManager, diagnosticsManager, {
      fs,
      loadConfig: async () => ({
        context: 'theme' as const,
        settings: {},
        checks: [LiquidFilter],
        rootUri,
      }),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        liquidDrops: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      jsonValidationSet: {
        schemas: async () => [],
      },
    });
  });

  it('should send diagnostics when there are errors', async () => {
    const fileContents = await fs.readFile(fileUri);
    const fileVersion = 0;
    documentManager.open(fileUri, fileContents, fileVersion);

    await runChecks([fileUri]);
    expect(connection.sendDiagnostics).toBeCalled();
    expect(connection.sendDiagnostics).toBeCalledWith({
      uri: fileUri,
      version: fileVersion,
      diagnostics: [
        {
          source: 'theme-check',
          code: 'LiquidFilter',
          message: 'Liquid filter can not be used',
          severity: 1,
          range: {
            start: {
              line: 0,
              character: 8,
            },
            end: {
              line: 0,
              character: 17,
            },
          },
        },
      ],
    });
  });

  it('should send an empty array when the errors were cleared', async () => {
    const fileContentsWithError = `{{ 'any' | filter }}`;
    const fileContentsWithoutError = `{{ 'any' }}`;
    let fileVersion = 1;

    // Open and have errors
    documentManager.open(fileUri, fileContentsWithError, fileVersion);
    await runChecks([fileUri]);

    // Change doc to fix errors
    fileVersion = 2;
    documentManager.change(fileUri, fileContentsWithoutError, fileVersion);
    await runChecks([fileUri]);

    expect(connection.sendDiagnostics).toBeCalledTimes(2);
    expect(connection.sendDiagnostics).toHaveBeenLastCalledWith({
      uri: fileUri,
      version: fileVersion,
      diagnostics: [],
    });
  });

  it('should send diagnostics per URI when there are errors', async () => {
    const files = [
      {
        fileURI: path.join(rootUri, 'snippets', 'input1.liquid'),
        fileContents: `{{ 'any' | filter }}`,
        fileVersion: 0,
        diagnostics: [
          {
            source: 'theme-check',
            code: 'LiquidFilter',
            message: 'Liquid filter can not be used',
            severity: 1,
            range: {
              start: {
                line: 0,
                character: 8,
              },
              end: {
                line: 0,
                character: 17,
              },
            },
          },
        ],
      },
      {
        fileURI: path.join(rootUri, 'snippets', 'input2.liquid'),
        // same but on a new line
        fileContents: `\n{{ 'any' | filter }}`,
        fileVersion: 0,
        diagnostics: [
          {
            source: 'theme-check',
            code: 'LiquidFilter',
            message: 'Liquid filter can not be used',
            severity: 1,
            range: {
              start: {
                line: 1,
                character: 8,
              },
              end: {
                line: 1,
                character: 17,
              },
            },
          },
        ],
      },
    ];

    files.forEach(({ fileURI, fileContents, fileVersion }) => {
      documentManager.open(fileURI, fileContents, fileVersion);
    });

    await runChecks([path.join(rootUri, 'snippets', 'input1.liquid')]);

    files.forEach(({ fileURI, fileVersion, diagnostics }) => {
      expect(connection.sendDiagnostics).toBeCalledWith({
        uri: fileURI,
        version: fileVersion,
        diagnostics,
      });
    });
  });

  it('should use the contents of the default translations file buffer (if any) instead of the result of the factory', async () => {
    const defaultPath = 'locales/en.default.json';
    const defaultURI = path.join(rootUri, ...defaultPath.split('/'));
    const frPath = 'locales/fr.json';
    const frURI = path.join(rootUri, ...frPath.split('/'));
    const files = {
      '.theme-check.yml': '',
      [defaultPath]: JSON.stringify({ hello: 'hello' }),
      [frPath]: JSON.stringify({ hello: 'bonjour', hi: 'salut' }),
    };

    const matchingTranslation = allChecks.filter((c) => c.meta.code === 'MatchingTranslations');
    expect(matchingTranslation).to.have.lengthOf(1);
    runChecks = makeRunChecks(documentManager, diagnosticsManager, {
      fs: new MockFileSystem(files, rootUri),
      loadConfig: async () => ({
        context: 'theme',
        settings: {},
        checks: matchingTranslation,
        rootUri: rootUri,
      }),
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        liquidDrops: async () => [],
        tags: async () => [],
        systemTranslations: async () => ({}),
      },
      jsonValidationSet: {
        schemas: async () => [],
      },
    });

    // Open and have errors
    documentManager.open(frURI, files[frPath], 0);
    await runChecks([frURI]);
    expect(connection.sendDiagnostics).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: frURI,
        version: 0,
        diagnostics: expect.arrayContaining([
          {
            source: 'theme-check',
            code: 'MatchingTranslations',
            codeDescription: { href: expect.any(String) },
            message: `A default translation for 'hi' does not exist`,
            severity: 1,
            range: {
              end: {
                character: 31,
                line: 0,
              },
              start: {
                character: 19,
                line: 0,
              },
            },
          },
        ]),
      }),
    );

    // Change the contents of the defaultURI buffer, expect frURI to be fixed
    documentManager.open(defaultURI, files[defaultPath], 0);
    documentManager.change(defaultURI, JSON.stringify({ hello: 'hello', hi: 'hi' }), 1);
    connection.sendDiagnostics.mockClear();
    await runChecks([frURI]);
    expect(connection.sendDiagnostics).toHaveBeenCalledWith({
      uri: frURI,
      version: 0,
      diagnostics: [],
    });
  });
});
