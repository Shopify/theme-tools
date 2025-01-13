import * as path from 'node:path';
import {
  DecorationOptions,
  Disposable,
  ExtensionContext,
  Position,
  Range,
  Uri,
  ViewColumn,
  WebviewPanel,
  window,
  workspace,
} from 'vscode';
import { exec } from './utils';

const SHOPIFY_CLI_COMMAND = 'shopify theme profile';

interface SharedProfileFrame {
  file: string;
  line: number;
  name: string;
}

interface ExecutionTimes {
  fileExecutionTimes: Map<string, number>;
  lineExecutionTimes: Map<SharedProfileFrame, number>;
}

export class LiquidProfiler {
  private fileDecorationType = window.createTextEditorDecorationType({
    before: {
      margin: '0 0 1rem 0',
      textDecoration: 'none',
    },
    rangeBehavior: 1, // DecorationRangeBehavior.ClosedOpen
  });

  private lineDecorationType = window.createTextEditorDecorationType({
    backgroundColor: 'rgba(173, 216, 230, 0.2)',
    border: '1px solid rgba(173, 216, 230, 0.5)',
    borderRadius: '3px',
  });

  private panel: WebviewPanel | undefined;
  private disposables: Disposable[] = [];
  private decorations = new Map<string, DecorationOptions[]>();
  private context: ExtensionContext;

  constructor(context: ExtensionContext) {
    this.context = context;
  }

  public async showProfileForUrl(url: string) {
    const profile = await fetchProfileContents(url);
    await this.processAndShowDecorations(profile);
    await this.showWebviewPanelForProfile(profile, url);
  }

  private async showWebviewPanelForProfile(profile: string, url: string) {
    const column = ViewColumn.Beside;

    if (this.panel) {
      this.panel.reveal(column);
      this.panel.title = `Liquid Profile: ${url}`;
      this.panel.webview.html = '';
    } else {
      this.panel = window.createWebviewPanel('liquidProfile', `Liquid Profile: ${url}`, column, {
        enableScripts: true,
        // Allow files in the user's workspace (.tmp directory) to be used as local resources
        localResourceRoots: [
          ...(workspace.workspaceFolders
            ? workspace.workspaceFolders.map((folder) => folder.uri)
            : []),
          Uri.file(this.context.asAbsolutePath(path.join('dist', 'node', 'speedscope'))),
        ],
      });
      this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    this.panel.webview.html = await this.getSpeedscopeHtml(profile);
  }

  private getSpeedscopeWebviewUri(fileName: string): Uri {
    const filePath = path.join('dist', 'node', 'speedscope', fileName);
    return this.panel!.webview.asWebviewUri(Uri.file(this.context.asAbsolutePath(filePath)));
  }

  private async getSpeedscopeHtml(profileContents: string) {
    const indexHtmlPath = Uri.file(
      this.context.asAbsolutePath(path.join('dist', 'node', 'speedscope', 'index.html')),
    );
    let htmlContent = Buffer.from(await workspace.fs.readFile(indexHtmlPath)).toString('utf8');

    // Convert local resource paths to vscode-resource URIs, and replace the paths in the HTML content
    const cssUri = this.getSpeedscopeWebviewUri('source-code-pro.52b1676f.css');
    htmlContent = htmlContent.replace('source-code-pro.52b1676f.css', cssUri.toString());

    const resetCssUri = this.getSpeedscopeWebviewUri('reset.8c46b7a1.css');
    htmlContent = htmlContent.replace('reset.8c46b7a1.css', resetCssUri.toString());

    const jsUri = this.getSpeedscopeWebviewUri('speedscope.6f107512.js');
    htmlContent = htmlContent.replace('speedscope.6f107512.js', jsUri.toString());

    // Put the profile JSON in a tmp file, and replace the profile URL in the HTML content.
    const tmpDir = workspace.workspaceFolders?.[0].uri.fsPath;
    const tmpFile = path.join(tmpDir!, '.tmp', 'profile.json');
    await workspace.fs.writeFile(Uri.file(tmpFile), Buffer.from(profileContents));
    const tmpUri = this.panel!.webview.asWebviewUri(Uri.file(tmpFile));
    htmlContent = htmlContent.replace(
      '<body>',
      `<body><script>window.location.hash = "profileURL=${encodeURIComponent(
        tmpUri.toString(),
      )}";</script>`,
    );

    return htmlContent;
  }

  public dispose() {
    this.panel?.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    this.panel = undefined;
  }

  /**
   * Calculate the execution times for each file and line in the profile.
   * @param profile - The parsed profile data.
   * @returns An object containing two maps:
   *     fileExecutionTimes: Map<string, number> - The execution time for each file.
   *     lineExecutionTimes: Map<number, number> - The execution time for each line.
   */
  private calculateExecutionTimes(profile: any): ExecutionTimes {
    const fileExecutionTimes = new Map<string, number>();
    const lineExecutionTimes = new Map<SharedProfileFrame, number>();
    const openEvents = new Map<number, number>();

    profile.profiles[0].events.forEach((event) => {
      const frameId = event.frame;
      const frame = profile.shared.frames[frameId];

      if (event.type === 'O') {
        openEvents.set(frameId, event.at);
      } else if (event.type === 'C') {
        const startTime = openEvents.get(frameId);
        if (startTime !== undefined) {
          const duration = event.at - startTime;

          if (
            frame.file &&
            (frame.file.startsWith('sections/') || frame.file.startsWith('snippets/'))
          ) {
            let current = lineExecutionTimes.get(frame) || 0;
            lineExecutionTimes.set(frame, current + duration);

            const liquidFile = `${frame.file}.liquid`;
            current = fileExecutionTimes.get(liquidFile) || 0;
            fileExecutionTimes.set(liquidFile, current + duration);
          }

          openEvents.delete(frameId);
        }
      }
    });

    return { fileExecutionTimes, lineExecutionTimes };
  }

  private async processAndShowDecorations(profileData: string) {
    console.log('[Liquid Profiler] Processing profile results for decorations');

    // Clear existing decorations
    this.decorations.clear();
    const visibleEditorsToClear = window.visibleTextEditors;
    for (const editor of visibleEditorsToClear) {
      editor.setDecorations(this.fileDecorationType, []);
      editor.setDecorations(this.lineDecorationType, []);
    }

    const parsedProfile = JSON.parse(profileData.toString());
    console.debug('[Liquid Profiler] Parsed valid profile JSON');

    const { fileExecutionTimes, lineExecutionTimes } = this.calculateExecutionTimes(parsedProfile);

    // Check if there are any workspace folders.
    // TODO: Is this necessary?
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders) {
      console.error('[Liquid Profiler] No workspace folders found');
      return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;

    // Apply decorations
    for (const [liquidFile, duration] of fileExecutionTimes) {
      const fullPath = path.join(rootPath, liquidFile);
      try {
        const uri = Uri.file(fullPath);
        const document = await workspace.openTextDocument(uri);

        // Create decoration for the first line of the file
        const firstLine = document.lineAt(0);
        const decoration: DecorationOptions = {
          range: firstLine.range,
          renderOptions: {
            after: {
              contentText: ` (File) ⏱️ ${(duration / 1000000).toFixed(2)}ms`,
              color: this.getColorForDuration(duration),
            },
          },
        };

        // Store the file-level decoration.
        this.decorations.set(uri.fsPath, [decoration]);

        const visibleEditors = window.visibleTextEditors;
        // Store the paths it's been applied to in a set.
        const appliedPaths = new Set<string>();
        for (const editor of visibleEditors) {
          if (
            editor.document.uri.fsPath === uri.fsPath &&
            !appliedPaths.has(editor.document.uri.fsPath)
          ) {
            console.log(`[Liquid Profiler] Applying file decoration for ${liquidFile} (${(
              duration / 1000000
            ).toFixed(2)}ms)
            `);
            editor.setDecorations(this.fileDecorationType, [decoration]);
            appliedPaths.add(editor.document.uri.fsPath);
          }
        }

        console.log(
          `[Liquid Profiler] Created file decoration for ${liquidFile} (${(
            duration / 1000000
          ).toFixed(2)}ms)`,
        );
      } catch (err) {
        console.error(`[Liquid Profiler] Error creating file decoration for ${fullPath}:`, err);
      }
    }

    // Decorations for lines
    for (const [frame, duration] of lineExecutionTimes) {
      try {
        const uri = Uri.file(path.join(rootPath, `${frame.file}.liquid`));
        const document = await workspace.openTextDocument(uri);
        // If frame.name starts with 'variable:', then scan the line for the variable name after "variable:" and find the
        // range immediately after the variable name to apply the decoration to
        let range: Range | undefined;
        if (frame.name.startsWith('variable:') || frame.name.startsWith('tag:')) {
          const variableName = frame.name.split('variable:')[1] || frame.name.split('tag:')[1];
          const line = document.lineAt(frame.line - 1);
          const variableRange = line.text.indexOf(variableName); // 7

          if (variableRange !== -1) {
            // Create range that covers the variable name itself using explicit positions
            range = new Range(
              new Position(line.lineNumber, variableRange),
              new Position(line.lineNumber, variableRange + variableName.length),
            );
          } else {
            // Fallback to full line if variable name not found
            range = line.range;
          }
          console.log(`[Liquid Profiler] Variable Range: ${range} Frame: ${frame}`);
        } else {
          const line = document.lineAt(frame.line - 1);
          console.log(`[Liquid Profiler] Line: ${line.range} Frame: ${frame}`);
          range = line.range;
        }
        const decoration: DecorationOptions = {
          range: range!,
          renderOptions: { after: { contentText: ` ⏱️ ${(duration / 1000000).toFixed(2)}ms` } },
        };

        // Store the decoration in a map where the key is the file path and the value is an array of decorations
        const fileDecorations = this.decorations.get(uri.fsPath) || [];
        fileDecorations.push(decoration);
        this.decorations.set(uri.fsPath, fileDecorations);
      } catch (err) {
        console.error(
          `[Liquid Profiler] Error creating line decoration for ${frame.file}:${frame.line}:`,
          err,
        );
      }
    }

    // Apply the decoration in the editor
    const visibleEditors = window.visibleTextEditors;
    for (const editor of visibleEditors) {
      // Get stored decorations for this file
      const lineDecorations = this.decorations.get(editor.document.uri.fsPath) || [];
      editor.setDecorations(this.lineDecorationType, lineDecorations);
    }

    // Add listener for active editor changes
    this.context.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          const decorations = this.decorations.get(editor.document.uri.fsPath);
          if (decorations) {
            editor.setDecorations(this.lineDecorationType, decorations);
          } else {
            editor.setDecorations(this.lineDecorationType, []);
            editor.setDecorations(this.fileDecorationType, []);
          }
        }
      }),
    );
  }

  private getColorForDuration(duration: number): string {
    // Convert nanoseconds to milliseconds for easier comparison
    const ms = duration / 1000000;
    if (ms < 10) {
      // Fast: Green
      return '#4caf50';
    }
    if (ms < 50) {
      // Medium: Yellow
      return '#ffc107';
    }
    // Slow: Red
    return '#f44336';
  }
}

export async function fetchProfileContents(url: string) {
  try {
    console.log('[Liquid Profiler] Attempting to load preview for URL:', url);
    const { stdout: result, stderr } = await exec(`${SHOPIFY_CLI_COMMAND} --url=${url} --json`);
    if (stderr) console.error(stderr);

    // Remove all characters leading up to the first {
    const content = result.toString().replace(/^[^{]+/, '');
    console.log(`[Liquid Profiler] Successfully retrieved preview content ${content}`);
    return content;
  } catch (error) {
    console.error('[Liquid Profiler] Error loading preview:', error);
    if (error instanceof Error) {
      // If there's stderr output, it will be in error.stderr
      const errorMessage = (error as any).stderr?.toString() || error.message;
      console.error('[Liquid Profiler] Error details:', errorMessage);
      return `<div style="color: red; padding: 20px;">
          <h3>Error loading preview:</h3>
          <pre>${errorMessage}</pre>
        </div>`;
    }
    console.error('[Liquid Profiler] Unexpected error type:', typeof error);
    return '<div style="color: red; padding: 20px;">An unexpected error occurred</div>';
  }
}
