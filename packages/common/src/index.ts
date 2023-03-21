import {
  Connection,
  Diagnostic,
  DiagnosticSeverity,
  InitializeResult,
  Range,
  TextDocumentSyncKind,
} from 'vscode-languageserver';
import {
  allChecks,
  check,
  Config,
  Offense,
  Severity,
  Theme,
  toSourceCode,
} from '@shopify/theme-check-common';
import { assertNever, immutableMapDelete, immutableMapSet } from './util';

interface Dependencies {
  log(message: string): void;
  debounce(fn: (...args: any[]) => void, ms?: number): (...args: any[]) => void;
}

const defaultLogger = () => {};
const defaultDebounce: Dependencies['debounce'] =
  (fn) =>
  (...args) =>
    fn(...args);

/**
 * This code runs in node and the browser, it can't talk to the file system
 * or make requests. Stuff like that should be injected.
 */
export function startServer(
  connection: Connection,
  { log = defaultLogger, debounce = defaultDebounce }: Partial<Dependencies>,
) {
  let rootUri: string;
  let _documentManager: DocumentManager;
  const documentManager = (_anything: any) => _documentManager; // TODO
  let config: Config;

  connection.onInitialize((params) => {
    rootUri = params.workspaceFolders?.[0]?.uri || '';
    config = configForPath(rootUri);
    _documentManager = new DocumentManager(rootUri);

    log(
      `[SERVER] Received initialize request with params:\n ${JSON.stringify(
        params,
        null,
        2,
      )}`,
    );
    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: {
          change: TextDocumentSyncKind.Full,
        },
      },
      serverInfo: {
        name: 'liquid-language-server',
        version: '0.0.1',
      },
    };
    return result;
  });

  connection.onInitialized(() => {
    log(`[SERVER] Let's roll!`);
  });

  connection.onDidOpenTextDocument((params) => {
    const { uri, text, version } = params.textDocument;
    documentManager(uri).open(uri, text, version);
    debouncedRunChecks(uri, version);
  });

  connection.onDidChangeTextDocument((params) => {
    const { uri, version } = params.textDocument;
    documentManager(uri).change(uri, params.contentChanges[0].text, version);
    debouncedRunChecks(uri, version);
  });

  connection.onDidCloseTextDocument((params) => {
    const { uri } = params.textDocument;
    documentManager(uri).close(uri);
  });

  const runChecks = async (uri: string, version: number) => {
    const offenses = await check(documentManager(uri).theme, config);
    console.log(documentManager(uri).theme);
    console.log(config);
    const diagnostics = offensesToDiagnostics(offenses);
    connection.sendDiagnostics({
      uri,
      version,
      diagnostics,
    });
  };
  const debouncedRunChecks = debounce(runChecks, 1000);

  connection.listen();
}

class DocumentManager {
  constructor(
    public rootUri: string,
    public theme: Theme = { files: new Map() },
  ) {}

  public open(uri: string, source: string, version: number | undefined) {
    return this.set(uri, source, version);
  }
  public change(uri: string, source: string, version: number | undefined) {
    return this.set(uri, source, version);
  }
  public close(uri: string) {
    return this.delete(uri);
  }

  private relativePath(uri: string) {
    return uri.replace(this.rootUri, '');
  }

  private set(uri: string, source: string, version: number | undefined) {
    const absolutePath = uri;
    const relativePath = this.relativePath(uri);
    const sourceCode = toSourceCode(
      relativePath,
      absolutePath,
      source,
      version,
    );
    if (!sourceCode) return;
    const files = immutableMapSet(this.theme.files, uri, sourceCode);
    this.theme = { files };
  }

  private delete(uri: string) {
    const files = immutableMapDelete(this.theme.files, uri);
    this.theme = { files };
  }
}

function configForPath(_rootPath: string): Config {
  //TODO load from file or default value in browser?
  // Mock for now
  return { settings: {}, checks: allChecks };
}

function offensesToDiagnostics(offenses: Offense[]): Diagnostic[] {
  let diagnostics: Diagnostic[] = [];

  for (let offense of offenses) {
    const range = offenseRangeToDiagnosticRange(offense);
    const message = offenseMessageToDiagnosticMessage(offense);
    const severity = offenseSeverityToDiagnosticSeverity(offense);

    diagnostics.push(Diagnostic.create(range, message, severity));
  }

  return diagnostics;
}

function offenseRangeToDiagnosticRange(offense: Offense): Range {
  return {
    start: offense.start,
    end: offense.end,
  };
}


function offenseMessageToDiagnosticMessage(offense: Offense): string {
  return `${offense.message} [${offense.check}]`;
}

function offenseSeverityToDiagnosticSeverity(
  offense: Offense,
): DiagnosticSeverity {
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
