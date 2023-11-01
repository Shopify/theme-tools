import { vi, expect, describe, it, beforeEach, afterEach } from 'vitest';
import { startServer } from './startServer';
import { MockConnection, mockConnection } from '../test/MockConnection';
import {
  DidCreateFilesNotification,
  DidDeleteFilesNotification,
  DidRenameFilesNotification,
  PublishDiagnosticsNotification,
} from 'vscode-languageserver';
import { ValidateFunction, allChecks } from '@shopify/theme-check-common';
import { Dependencies } from '../types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AbsolutePath = string;

describe('Module: server', () => {
  const filePath = 'snippets/code.liquid';
  const fileURI = `browser:///${filePath}`;
  const fileContents = `{% render 'foo' %}`;
  let connection: MockConnection;
  let dependencies: ReturnType<typeof getDependencies>;
  let fileTree: Set<AbsolutePath>;
  let logger: any;

  beforeEach(() => {
    // Initialize all ze mocks...
    connection = mockConnection();
    fileTree = new Set(['snippets/code.liquid']);
    logger = vi.fn();
    dependencies = getDependencies(logger, fileTree);

    // Start the server
    startServer(connection, dependencies);

    // Perform the initialize/initialized setup steps
    connection.setup();

    // Stop the time
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should log Let's roll! on successful setup", () => {
    expect(logger).toHaveBeenCalledWith("[SERVER] Let's roll!");
  });

  it('should debounce calls to runChecks', async () => {
    connection.openDocument(filePath, `{% echo 'hello' %}`);
    connection.changeDocument(filePath, `{% echo 'hello w' %}`, 1);
    connection.changeDocument(filePath, `{% echo 'hello wor' %}`, 2);
    connection.changeDocument(filePath, `{% echo 'hello world' %}`, 3);
    await flushAsync();

    // Make sure nothing was sent
    expect(connection.spies.sendNotification).not.toHaveBeenCalled();

    // Advance time by debounce time
    await advanceAndFlush(100);

    // Make sure you get the diagnostics you'd expect (for the right
    // version of the file)
    expect(connection.spies.sendNotification).toHaveBeenCalledOnce();
    expect(connection.spies.sendNotification).toHaveBeenCalledWith(
      PublishDiagnosticsNotification.type,
      {
        diagnostics: [],
        uri: fileURI,
        version: 3,
      },
    );
  });

  it('should trigger a re-check on did create files notifications', async () => {
    // Setup & expectations
    connection.openDocument(filePath, fileContents);
    await advanceAndFlush(100);
    expect(connection.spies.sendNotification).toHaveBeenCalledWith(
      PublishDiagnosticsNotification.type,
      {
        uri: fileURI,
        version: 0,
        diagnostics: [missingTemplateDiagnostic()],
      },
    );

    // Clear mocks for future use
    connection.spies.sendNotification.mockClear();

    // Trigger create files notification & update mocks
    connection.triggerNotification(DidCreateFilesNotification.type, {
      files: [
        {
          uri: 'browser:///snippets/foo.liquid',
        },
        {
          uri: 'browser:///snippets/bar.liquid',
        },
      ],
    });
    fileTree.add('/snippets/foo.liquid');
    fileTree.add('/snippets/bar.liquid');
    await advanceAndFlush(100);

    // Verify that we re-check'ed filePath to remove the linting error
    expect(connection.spies.sendNotification).toHaveBeenCalledOnce();
    expect(connection.spies.sendNotification).toHaveBeenCalledWith(
      PublishDiagnosticsNotification.type,
      {
        diagnostics: [],
        uri: fileURI,
        version: 0,
      },
    );
  });

  it('should trigger a re-check on did file rename notifications', async () => {
    // Setup & expectations
    fileTree.add('/snippets/bar.liquid');
    connection.openDocument(filePath, fileContents);
    await advanceAndFlush(100);
    expect(connection.spies.sendNotification).toHaveBeenCalledWith(
      PublishDiagnosticsNotification.type,
      {
        uri: fileURI,
        version: 0,
        diagnostics: [missingTemplateDiagnostic()],
      },
    );

    // Reset mocks for different expectations later
    connection.spies.sendNotification.mockClear();

    // Trigger a file rename notification
    connection.triggerNotification(DidRenameFilesNotification.type, {
      files: [
        {
          oldUri: 'browser:///snippets/bar.liquid',
          newUri: 'browser:///snippets/foo.liquid',
        },
      ],
    });

    // Adjust mocks
    fileTree.delete('/snippets/bar.liquid');
    fileTree.add('/snippets/foo.liquid');

    // Advance time
    await advanceAndFlush(100);

    // Make sure only one publishDiagnostics has been called and that the
    // error disappears because of the file rename.
    expect(connection.spies.sendNotification).toHaveBeenCalledOnce();
    expect(connection.spies.sendNotification).toHaveBeenCalledWith(
      PublishDiagnosticsNotification.type,
      {
        diagnostics: [],
        uri: fileURI,
        version: 0,
      },
    );
  });

  it('should trigger a re-check on did delete files notifications', async () => {
    // Setup and expectations (no errors)
    fileTree.add('/snippets/foo.liquid');
    connection.openDocument(filePath, fileContents);
    await advanceAndFlush(100);
    expect(connection.spies.sendNotification).toHaveBeenCalledWith(
      PublishDiagnosticsNotification.type,
      {
        uri: fileURI,
        version: 0,
        diagnostics: [],
      },
    );

    // Clear mocks for future expectations
    connection.spies.sendNotification.mockClear();

    // Notify about file delete
    connection.triggerNotification(DidDeleteFilesNotification.type, {
      files: [
        {
          uri: 'browser:///snippets/foo.liquid',
        },
      ],
    });
    fileTree.delete('/snippets/foo.liquid');
    await advanceAndFlush(100);

    // Make sure there's an error now that the file no longer exists
    expect(connection.spies.sendNotification).toHaveBeenCalledOnce();
    expect(connection.spies.sendNotification).toHaveBeenCalledWith(
      PublishDiagnosticsNotification.type,
      {
        diagnostics: [missingTemplateDiagnostic()],
        uri: fileURI,
        version: 0,
      },
    );
  });

  // When you're using fake timers and stuff runs async, you want to flush
  // the async stuff that would happen on a timer.
  //
  // We can't simply `await sleep(1)` because the timer is stopped, so we
  // do this Promise.all thing here that does both.
  function flushAsync() {
    return Promise.all([vi.advanceTimersByTimeAsync(1), sleep(1)]);
  }

  function advanceAndFlush(ms: number) {
    vi.advanceTimersByTime(ms);
    return flushAsync();
  }

  function getDependencies(logger: any, fileTree: Set<AbsolutePath>) {
    const MissingTemplate = allChecks.filter((c) => c.meta.code === 'MissingTemplate');

    return {
      findRootURI: async (_: string) => 'browser:///',
      fileExists: vi
        .fn()
        .mockImplementation(async (absolutePath: string) => fileTree.has(absolutePath)),
      fileSize: vi.fn().mockResolvedValue(420),
      getDefaultTranslationsFactory: () => async () => ({}),
      getDefaultLocaleFactory: () => async () => 'en',
      getThemeSettingsSchemaForRootURI: async () => [],
      loadConfig: async () => ({
        settings: {},
        checks: MissingTemplate,
        root: '/',
      }),
      log: logger,
      themeDocset: {
        filters: async () => [],
        objects: async () => [],
        tags: async () => [],
      },
      schemaValidators: {
        validateSectionSchema: async () => ({} as ValidateFunction),
      },
    } as Dependencies;
  }

  function missingTemplateDiagnostic() {
    return {
      code: 'MissingTemplate',
      codeDescription: { href: expect.any(String) },
      message: "'snippets/foo.liquid' does not exist",
      severity: 1,
      source: 'theme-check',
      range: {
        start: {
          character: 10,
          line: 0,
        },
        end: {
          character: 15,
          line: 0,
        },
      },
    };
  }
});
