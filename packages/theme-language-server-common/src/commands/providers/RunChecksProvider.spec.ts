import { describe, it, expect, vi, beforeEach } from 'vitest';
import { URI } from 'vscode-uri';
import { Connection } from 'vscode-languageserver';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DiagnosticsManager, makeRunChecks } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { DebouncedFunction } from '../../utils';
import { RunChecksProvider } from './RunChecksProvider';

describe('Unit: RunChecksProvider', () => {
  const uri1 = URI.file('/path/to/file1.liquid').toString();
  const uri2 = URI.file('/path/to/file2.liquid').toString();
  const contents1 = `
    {% assign x = 1 %}
    <script src="2.js"></script>
    <script src="3.js"></script>
  `;
  const contents2 = `
    {% assign y = 2 %}
    <script src="4.js"></script>
    <script src="5.js"></script>
  `;
  const version = 0;
  let connection: Connection;
  let documentManager: DocumentManager;
  let diagnosticsManager: DiagnosticsManager;
  let clientCapabilities: ClientCapabilities;
  let runChecks: DebouncedFunction<ReturnType<typeof makeRunChecks>>;
  let runChecksProvider: RunChecksProvider;

  beforeEach(() => {
    connection = {} as Connection;
    documentManager = new DocumentManager();
    diagnosticsManager = new DiagnosticsManager(connection);
    clientCapabilities = new ClientCapabilities();
    runChecks = vi.fn() as any as RunChecksProvider['runChecks'];
    runChecksProvider = new RunChecksProvider(
      documentManager,
      diagnosticsManager,
      clientCapabilities,
      connection,
      runChecks,
    );
    documentManager.open(uri1, contents1, version);
    documentManager.open(uri2, contents2, version);
  });

  describe('execute', () => {
    it('calls runChecks with the trigger URIs of all the open documents', async () => {
      await runChecksProvider.execute();
      expect(runChecks).toHaveBeenCalledWith([uri1, uri2]);
    });
  });
});
