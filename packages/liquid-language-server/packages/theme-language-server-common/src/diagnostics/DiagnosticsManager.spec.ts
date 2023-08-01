import { Offense, SourceCodeType } from '@shopify/theme-check-common';
import { vi, expect, describe, it, beforeEach } from 'vitest';
import { Connection, Diagnostic, Range } from 'vscode-languageserver';
import { DiagnosticsManager } from './DiagnosticsManager';
import { offenseToDiagnostic } from './offenseToDiagnostic';

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
    const offenses: Offense[] = [
      {
        absolutePath: '/input.liquid',
        message: 'Test',
        check: 'TestCheck',
        start: {
          character: 0,
          line: 0,
          index: 0,
        },
        end: {
          character: 10,
          line: 0,
          index: 10,
        },
        severity: 0,
        type: SourceCodeType.LiquidHtml,
      },
    ];
    const diagnostics = offenses.map(offenseToDiagnostic);
    diagnosticsManager.set(fileURI, fileVersion, offenses);
    expect(connection.sendDiagnostics).toBeCalledWith({
      uri: fileURI,
      version: fileVersion,
      diagnostics,
    });
  });

  it('should sendDiagnostics with an empty array on clear', () => {
    const fileURI = 'browser:///input.liquid';
    const fileVersion = 0;
    const offenses: Offense[] = [
      {
        absolutePath: '/input.liquid',
        message: 'Test',
        check: 'TestCheck',
        start: {
          character: 0,
          line: 0,
          index: 0,
        },
        end: {
          character: 10,
          line: 0,
          index: 10,
        },
        severity: 0,
        type: SourceCodeType.LiquidHtml,
      },
    ];
    diagnosticsManager.set(fileURI, fileVersion, offenses);
    diagnosticsManager.clear(fileURI);
    expect(connection.sendDiagnostics).toBeCalledTimes(2);
    expect(connection.sendDiagnostics).toHaveBeenLastCalledWith({
      uri: fileURI,
      diagnostics: [],
    });
  });
});
