import { Diagnostic } from 'vscode-languageserver';
import { Offense, Severity } from '@shopify/theme-check-common';
export declare function offenseToDiagnostic(offense: Offense): Diagnostic;
export declare function offenseSeverity(diagnostic: Diagnostic): Severity;
