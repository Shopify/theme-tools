import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { Offense, Severity } from '@shopify/theme-check-common';
import { assertNever } from '../utils';

export function offenseToDiagnostic(offense: Offense): Diagnostic {
  return Diagnostic.create(
    diagnosticRange(offense),
    offense.message,
    diagnosticSeverity(offense),
    offense.check,
    'theme-check',
  );
}

function diagnosticRange({ start, end }: Offense): Range {
  return {
    start: {
      line: start.line,
      character: start.character,
    },
    end: {
      line: end.line,
      character: end.character,
    },
  };
}

function diagnosticSeverity(offense: Offense): DiagnosticSeverity {
  switch (offense.severity) {
    case Severity.INFO: {
      return DiagnosticSeverity.Information;
    }
    case Severity.WARNING: {
      return DiagnosticSeverity.Warning;
    }
    case Severity.ERROR: {
      return DiagnosticSeverity.Error;
    }
    default: {
      return assertNever(offense.severity);
    }
  }
}
