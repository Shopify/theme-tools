import { Offense, SourceCodeType, WithRequired } from '@shopify/theme-check-common';
import { CodeAction, CodeActionKind, Command, Diagnostic } from 'vscode-languageserver';
import { Anomaly } from '../../diagnostics';
export declare function toCodeAction(title: string, command: Command, diagnostics: Diagnostic[], kind: CodeActionKind, isPreferred?: boolean): CodeAction;
/**
 * The range is either the selection or cursor position, an offense is in
 * range if the selection and offense overlap in any way.
 */
export declare function isInRange({ offense }: Anomaly, start: number, end: number): boolean;
/**
 * An anomaly is fixable if the offense has the `fix` attribute
 *
 * This type guarantees that Offense.fix is defined (and is thus fixable).
 */
export type FixableAnomaly<S extends SourceCodeType = SourceCodeType> = S extends SourceCodeType ? {
    diagnostic: Diagnostic;
    offense: WithRequired<Offense<S>, 'fix'>;
    id: number;
} : never;
export declare function isFixable(anomaly: Anomaly): anomaly is FixableAnomaly;
