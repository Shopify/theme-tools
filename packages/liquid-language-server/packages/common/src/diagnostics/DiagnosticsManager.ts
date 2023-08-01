import { Offense } from '@shopify/theme-check-common';
import { Connection, Diagnostic, URI } from 'vscode-languageserver';
import { offenseToDiagnostic } from './offenseToDiagnostic';

/**
 * Anomalies are used to represent both the diagnostic and offense in a
 * single type. That way we can make codeAction associations easily.
 */
export type Anomaly = {
  offense: Offense;
  diagnostic: Diagnostic;
  id: number;
};

export type Diagnostics = {
  uri: string;
  version: number | undefined;
  anomalies: Anomaly[];
};

export class DiagnosticsManager {
  private diagnostics = new Map<URI, Diagnostics>();

  constructor(private connection: Connection) {}

  get(uri: URI) {
    return this.diagnostics.get(uri);
  }

  set(uri: URI, version: number | undefined, offenses: Offense[]) {
    const anomalies: Anomaly[] = offenses.map((offense, index) => ({
      offense,
      diagnostic: offenseToDiagnostic(offense),
      id: index,
    }));

    this.diagnostics.set(uri, {
      uri,
      version,
      anomalies,
    });

    this.connection.sendDiagnostics({
      uri,
      version,
      diagnostics: anomalies.map((a) => a.diagnostic),
    });
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
