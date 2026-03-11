import { Offense } from '@shopify/theme-check-common';
import { Connection, Diagnostic, URI } from 'vscode-languageserver';
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
export declare class DiagnosticsManager {
    private connection;
    private diagnostics;
    constructor(connection: Connection);
    get(uri: URI): Diagnostics | undefined;
    set(uri: URI, version: number | undefined, offenses: Offense[]): void;
    clear(uri: URI): void;
}
