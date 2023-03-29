import { vi, expect, describe, it, beforeEach } from 'vitest';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '@shopify/theme-check-common';
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
      LiquidFilter: async (node, file) => {
        context.report(file, {
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

  beforeEach(() => {
    connection = {
      sendDiagnostics: vi.fn(),
    };

    diagnosticsManager = new DiagnosticsManager(connection as any as Connection);
    documentManager = new DocumentManager();
    runChecks = makeRunChecks({
      findRootURI: async () => 'browser:///',
      fileExists: async () => true,
      getDefaultTranslationsFactory: () => async () => ({}),
      loadConfig: async () => ({
        settings: {},
        checks: [LiquidFilter],
        root: 'browser:///',
      }),
    });
  });

  it('should send diagnostics when there are errors', async () => {
    const fileURI = 'browser:///input.liquid';
    const fileContents = `{{ 'any' | filter }}`;
    const fileVersion = 0;
    documentManager.open(fileURI, fileContents, fileVersion);

    await runChecks(documentManager, diagnosticsManager, 'browser:///input.liquid');
    expect(connection.sendDiagnostics).toBeCalled();
    expect(connection.sendDiagnostics).toBeCalledWith({
      uri: fileURI,
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
    const fileURI = 'browser:///input.liquid';
    const fileContentsWithError = `{{ 'any' | filter }}`;
    const fileContentsWithoutError = `{{ 'any' }}`;
    let fileVersion = 1;

    // Open and have errors
    documentManager.open(fileURI, fileContentsWithError, fileVersion);
    await runChecks(documentManager, diagnosticsManager, 'browser:///input.liquid');

    // Change doc to fix errors
    fileVersion = 2;
    documentManager.change(fileURI, fileContentsWithoutError, fileVersion);
    await runChecks(documentManager, diagnosticsManager, 'browser:///input.liquid');

    expect(connection.sendDiagnostics).toBeCalledTimes(2);
    expect(connection.sendDiagnostics).toHaveBeenLastCalledWith({
      uri: fileURI,
      version: fileVersion,
      diagnostics: [],
    });
  });

  it('should send diagnostics per URI when there are errors', async () => {
    const files = [
      {
        fileURI: 'browser:///input1.liquid',
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
        fileURI: 'browser:///input2.liquid',
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

    await runChecks(documentManager, diagnosticsManager, 'browser:///input1.liquid');

    files.forEach(({ fileURI, fileVersion, diagnostics }) => {
      expect(connection.sendDiagnostics).toBeCalledWith({
        uri: fileURI,
        version: fileVersion,
        diagnostics,
      });
    });
  });
});
