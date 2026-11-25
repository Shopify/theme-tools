import type { LintDiagnostic } from './lint-liquid';

export interface NormalizedError {
  detected: boolean;
  line: number | null;
  coreMessage: string;
}

export function normalizeSnapshot(snap: {
  error: string | null;
  type: string | null;
}): NormalizedError {
  if (!snap.error) {
    return { detected: false, line: null, coreMessage: '' };
  }

  return {
    detected: true,
    line: null,
    coreMessage: snap.error.toLowerCase().trim(),
  };
}

export function normalizeThemeCheck(diagnostics: LintDiagnostic[]): NormalizedError {
  if (diagnostics.length === 0) {
    return { detected: false, line: null, coreMessage: '' };
  }

  let msg = diagnostics[0].message.toLowerCase().trim();

  if (msg.startsWith('liquidhtmlsyntaxerror: ')) {
    msg = msg.slice('liquidhtmlsyntaxerror: '.length).trim();
  }

  if (msg.startsWith('syntax error: ')) {
    msg = msg.slice('syntax error: '.length).trim();
  }

  return {
    detected: true,
    line: diagnostics[0].line,
    coreMessage: msg,
  };
}
