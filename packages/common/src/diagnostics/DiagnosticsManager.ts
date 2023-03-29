import {
  Connection,
  Diagnostic,
  PublishDiagnosticsParams,
  URI,
} from 'vscode-languageserver';

export class DiagnosticsManager {
  private diagnostics = new Map<URI, PublishDiagnosticsParams>();

  constructor(private connection: Connection) {}

  set(uri: URI, version: number | undefined, diagnostics: Diagnostic[]) {
    this.diagnostics.set(uri, {
      uri,
      version,
      diagnostics,
    });

    this.connection.sendDiagnostics(this.diagnostics.get(uri)!);
  }

  clear(uri: URI) {
    this.diagnostics.delete(uri);
    this.connection.sendDiagnostics({
      uri,
      version: undefined,
      diagnostics: [],
    });
  }
}
