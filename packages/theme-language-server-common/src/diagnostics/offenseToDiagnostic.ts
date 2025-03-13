import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { allChecks, Offense, Severity, assertNever } from '@shopify/theme-check-common';

type CheckToDocsUrl = {
  [code in string]?: string;
};

const checkToDocsUrl = allChecks.reduce<CheckToDocsUrl>((acc, checkDescription) => {
  const url = checkDescription.meta.docs.url;
  const code = checkDescription.meta.code;
  if (url !== undefined) {
    acc[code] = url;
  }
  return acc;
}, {});

export function offenseToDiagnostic(offense: Offense): Diagnostic {
  const diagnostic = Diagnostic.create(
    diagnosticRange(offense),
    offense.message,
    diagnosticSeverity(offense),
    offense.check,
    'theme-check',
  );

  const url = checkToDocsUrl[offense.check];
  if (url) {
    diagnostic.codeDescription = { href: url };
  }

  return diagnostic;
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

export function offenseSeverity(diagnostic: Diagnostic): Severity {
  switch (diagnostic.severity) {
    case DiagnosticSeverity.Hint:
    case DiagnosticSeverity.Information: {
      return Severity.INFO;
    }
    case DiagnosticSeverity.Warning: {
      return Severity.WARNING;
    }
    case DiagnosticSeverity.Error: {
      return Severity.ERROR;
    }
    default: {
      return Severity.INFO;
    }
  }
}
