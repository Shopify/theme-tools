import { vi, expect, describe, it, beforeEach } from 'vitest';
import { Connection, Diagnostic, Range } from 'vscode-languageserver';
import { DiagnosticsManager } from './DiagnosticsManager';

describe('Module: DiagnosticsManager', () => {
  let diagnosticsManager: DiagnosticsManager;
  let connection: { sendDiagnostics: ReturnType<typeof vi.fn> };
  beforeEach(() => {
    connection = {
      sendDiagnostics: vi.fn(),
    };

    diagnosticsManager = new DiagnosticsManager(connection as any as Connection);
  });

  it('should send diagnostics on set', () => {
    const fileURI = 'browser:///input.liquid';
    const fileVersion = 0;
    const range: Range = {
      start: {
        line: 0,
        character: 0,
      },
      end: {
        line: 10,
        character: 10,
      },
    };
    const diagnostics: Diagnostic[] = [Diagnostic.create(range, 'test', 1, 'Test', 'theme-check')];
    diagnosticsManager.set(fileURI, fileVersion, diagnostics);
    expect(connection.sendDiagnostics).toBeCalledWith({
      uri: fileURI,
      version: fileVersion,
      diagnostics,
    });
  });

  it('should sendDiagnostics with an empty array on clear', () => {
    const fileURI = 'browser:///input.liquid';
    const fileVersion = 0;
    const range: Range = {
      start: {
        line: 0,
        character: 0,
      },
      end: {
        line: 10,
        character: 10,
      },
    };
    const diagnostics: Diagnostic[] = [Diagnostic.create(range, 'test', 1, 'Test', 'theme-check')];
    diagnosticsManager.set(fileURI, fileVersion, diagnostics);
    diagnosticsManager.clear(fileURI);
    expect(connection.sendDiagnostics).toBeCalledTimes(2);
    expect(connection.sendDiagnostics).toHaveBeenLastCalledWith({
      uri: fileURI,
      diagnostics: [],
    });
  });
});
