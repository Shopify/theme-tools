import * as vscode from 'vscode';
import { EXTENSION_ID, LANGUAGE_SERVER_TIMEOUT_MS } from './helpers';

/**
 * The language server runs in its own web worker. Its console and uncaught
 * errors never reach the extension host, where the tests run, so a server
 * that throws on every request can still look healthy from here.
 *
 * `startMonitoredLanguageServer` restarts the server inside a worker that
 * reports those errors back, and returns the errors it collects. The
 * extension starts its server before any test runs, so a restart is the only
 * way to watch the worker from its first line.
 */
export function startMonitoredLanguageServer(): Promise<LanguageServerWorker> {
  return (started ??= start());
}

export interface LanguageServerError {
  source: string;
  message: string;
}

export class LanguageServerWorker {
  readonly errors: LanguageServerError[] = [];
  readonly initialized: Promise<void>;
  readonly reporting: Promise<void>;

  private markInitialized!: () => void;
  private markReporting!: () => void;
  private channel = new BroadcastChannel(ERROR_CHANNEL);

  constructor() {
    this.initialized = new Promise((resolve) => (this.markInitialized = resolve));
    this.reporting = new Promise((resolve) => (this.markReporting = resolve));
    this.channel.onmessage = ({ data }: MessageEvent<WorkerReport>) => {
      if (data.source === 'ready') this.markReporting();
      else this.errors.push(data);
    };
  }

  watch(worker: Worker) {
    worker.addEventListener('error', (event) => {
      this.errors.push({ source: 'worker error event', message: event.message || 'Script error' });
    });
    worker.addEventListener('message', ({ data }) => this.inspect(data));
  }

  /** Reads the JSON-RPC messages that the server sends to the extension. */
  private inspect(message: any) {
    if (!message || typeof message !== 'object') return;

    if (message.result?.serverInfo?.name === 'theme-language-server') {
      this.markInitialized();
    }

    const isNotification =
      message.method === 'window/logMessage' || message.method === 'window/showMessage';
    if (isNotification && message.params?.type === MESSAGE_TYPE_ERROR) {
      this.errors.push({ source: message.method, message: message.params.message });
    }

    if (message.id !== undefined && message.error && !CANCELLED.has(message.error.code)) {
      this.errors.push({
        source: 'error response',
        message: `${message.error.code} ${message.error.message}`,
      });
    }
  }
}

let started: Promise<LanguageServerWorker> | undefined;

const ERROR_CHANNEL = 'theme-check-vscode-e2e:language-server-errors';
const SERVER_SCRIPT = /\/dist\/browser\/server\.js([?#]|$)/;
const MESSAGE_TYPE_ERROR = 1;
// RequestCancelled and ContentModified: VS Code cancels requests as you type.
const CANCELLED = new Set([-32800, -32801]);

interface WorkerReport {
  source: string;
  message: string;
}

async function start() {
  const extension = vscode.extensions.getExtension(EXTENSION_ID)!;
  await extension.activate();

  const server = new LanguageServerWorker();
  const restoreWorker = interceptServerWorker(server);
  try {
    await vscode.commands.executeCommand('shopifyLiquid.restart');
  } finally {
    restoreWorker();
  }

  await withTimeout(server.reporting, 'the language server worker to report errors');
  await withTimeout(server.initialized, 'the language server to answer initialize');
  return server;
}

/**
 * Makes the next `new Worker(".../dist/browser/server.js")` load the server
 * after a script that reports the worker's errors on a BroadcastChannel.
 */
function interceptServerWorker(server: LanguageServerWorker) {
  const scope = globalThis as any;
  const OriginalWorker = scope.Worker;

  function InterceptedWorker(url: string | URL, options?: WorkerOptions) {
    if (!SERVER_SCRIPT.test(String(url))) return new OriginalWorker(url, options);

    const worker: Worker = new OriginalWorker(reportingWorkerUrl(String(url)), options);
    server.watch(worker);
    return worker;
  }
  InterceptedWorker.prototype = OriginalWorker.prototype;

  scope.Worker = InterceptedWorker;
  return () => {
    scope.Worker = OriginalWorker;
  };
}

function reportingWorkerUrl(serverUrl: string) {
  const source = [
    `(${reportErrors.toString()})(${JSON.stringify(ERROR_CHANNEL)});`,
    `importScripts(${JSON.stringify(serverUrl)});`,
  ].join('\n');
  return URL.createObjectURL(new Blob([source], { type: 'application/javascript' }));
}

/**
 * Runs inside the language server worker, before the server. It is
 * stringified, so it can't use anything from this module.
 */
function reportErrors(channelName: string) {
  const channel = new BroadcastChannel(channelName);
  const format = (value: unknown) => {
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };
  const report = (source: string, values: unknown[]) => {
    channel.postMessage({ source, message: values.map(format).join(' ') });
  };

  const consoleError = console.error.bind(console);
  console.error = (...values: unknown[]) => {
    report('console.error', values);
    consoleError(...values);
  };
  self.addEventListener('error', (event: ErrorEvent) => {
    report('uncaught error', [event.error ?? event.message]);
  });
  self.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    report('unhandled rejection', [event.reason]);
  });

  report('ready', []);
}

async function withTimeout(promise: Promise<void>, description: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(`Timed out after ${LANGUAGE_SERVER_TIMEOUT_MS}ms waiting for ${description}`),
        ),
      LANGUAGE_SERVER_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
