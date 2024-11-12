import { Connection } from 'vscode-languageserver';
import { WorkDoneProgress, WorkDoneProgressCreateRequest } from 'vscode-languageserver-protocol';
import { ClientCapabilities } from './ClientCapabilities';

export interface IProgress {
  start(title: string, initialMessage?: string): Promise<void>;
  report(percentage?: number, message?: string): Promise<void>;
  end(message?: string): Promise<void>;
}

/**
 * A short hand for handling progress reporting to the language client.
 *
 * It handles all the LSP protocol details for you.
 *
 * @example
 * const progress = Progress.create(connection, capabilities, progressToken);
 * await progress.start('Starting progress');
 * await progress.report(50, 'Halfway there');
 * await progress.end('Finished');
 */
export class Progress {
  constructor(private connection: Connection, private progressToken: string) {}

  static create(
    connection: Connection | undefined,
    capabilities: ClientCapabilities | undefined,
    progressToken: string,
  ): IProgress {
    if (!connection || !capabilities || !capabilities.hasProgressSupport) {
      // If you don't have a connection, we give you a mock that doesn't do anything.
      return {
        start: async () => {},
        report: async () => {},
        end: async () => {},
      } as IProgress;
    }
    return new Progress(connection!, progressToken);
  }

  async start(title: string) {
    await this.connection.sendRequest(WorkDoneProgressCreateRequest.type, {
      token: this.progressToken,
    });
    await this.connection.sendProgress(WorkDoneProgress.type, this.progressToken, {
      kind: 'begin',
      title,
    });
  }

  async report(percentage?: number, message?: string) {
    await this.connection.sendProgress(WorkDoneProgress.type, this.progressToken, {
      kind: 'report',
      message,
      percentage,
    });
  }

  async end(message?: string) {
    await this.connection.sendProgress(WorkDoneProgress.type, this.progressToken, {
      kind: 'end',
      message,
    });
  }
}

/**
 * Given a current/total and an offset, report the percent complete
 * @param current - number of items processed from total
 * @param total   - total number of items
 * @param offset  - offset % to start at
 *
 * @example
 * const offset = 50 // Start at 50%
 * const current = 0
 * const total = 100 // files or whatever
 * percent(0, total, offset)   // 50 %
 * percent(50, total, offset)  // 75 %
 * percent(100, total, offset) // 100 %
 */
export function percent(current: number, total: number, offset: number = 0) {
  return Math.round(offset + (current / total) * (100 - offset));
}
