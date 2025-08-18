import { AbstractFileSystem, FileTuple, FileStat } from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import { URI } from 'vscode-uri';

/** e.g. `file`, `vscode-vfs`, `github`, `browser` */
export type UriScheme = string;

/**
 * An optimization we can use so the Language Server can avoid
 * querying VS Code for information.
 *
 * In the desktop version of the extension, the `file` scheme gets mapped to the
 * NodeFileSystem class.
 *
 * In the browser, this is not available, so the Language Server queries
 * VS Code for the information.
 */
export type FileSystems = Record<UriScheme, AbstractFileSystem>;

export class VsCodeFileSystem implements AbstractFileSystem {
  constructor(
    private connection: Connection,
    private fileSystems: Record<UriScheme, AbstractFileSystem>,
  ) {}

  readDirectory(uriString: string): Promise<FileTuple[]> {
    const uri = URI.parse(uriString);
    const fs = this.fileSystems[uri.scheme];
    if (fs) return fs.readDirectory(uriString);
    return this.connection.sendRequest('fs/readDirectory', uriString);
  }

  readFile(uriString: string): Promise<string> {
    const uri = URI.parse(uriString);
    const fs = this.fileSystems[uri.scheme];
    if (fs) return fs.readFile(uriString);
    return this.connection.sendRequest('fs/readFile', uriString);
  }

  stat(uriString: string): Promise<FileStat> {
    const uri = URI.parse(uriString);
    const fs = this.fileSystems[uri.scheme];
    if (fs) return fs.stat(uriString);
    return this.connection.sendRequest('fs/stat', uriString);
  }

  async readFiles(uriStrings: string[]): Promise<Map<string, string>> {
    // Group URIs by scheme for optimal batching
    const urisByScheme = new Map<string, string[]>();
    for (const uriString of uriStrings) {
      const uri = URI.parse(uriString);
      const scheme = uri.scheme;
      if (!urisByScheme.has(scheme)) {
        urisByScheme.set(scheme, []);
      }
      urisByScheme.get(scheme)!.push(uriString);
    }

    const result = new Map<string, string>();

    // Process each scheme group
    for (const [scheme, uris] of urisByScheme) {
      const fs = this.fileSystems[scheme];

      if (fs && fs.readFiles) {
        // Use batch method if available
        const batchResult = await fs.readFiles(uris);
        for (const [uri, content] of batchResult) {
          result.set(uri, content);
        }
      } else if (fs) {
        // Fall back to individual reads for this scheme
        const promises = uris.map(async (uri) => {
          try {
            const content = await fs.readFile(uri);
            return { uri, content };
          } catch (error) {
            console.error(`Failed to read file ${uri}:`, error);
            return { uri, content: '' };
          }
        });
        const results = await Promise.all(promises);
        for (const { uri, content } of results) {
          result.set(uri, content);
        }
      } else {
        // Use batch IPC call to VSCode
        try {
          const batchResult = await this.connection.sendRequest('fs/readFiles', uris);
          if (batchResult instanceof Map) {
            for (const [uri, content] of batchResult) {
              result.set(uri, content);
            }
          } else {
            // Fallback to individual IPC calls if batch method not supported
            const promises = uris.map(async (uri) => {
              try {
                const content = await this.connection.sendRequest('fs/readFile', uri);
                return { uri, content };
              } catch (error) {
                console.error(`Failed to read file ${uri}:`, error);
                return { uri, content: '' };
              }
            });
            const results = await Promise.all(promises);
            for (const { uri, content } of results) {
              result.set(uri, content);
            }
          }
        } catch (error) {
          // If batch request fails, fall back to individual requests
          const promises = uris.map(async (uri) => {
            try {
              const content = await this.connection.sendRequest('fs/readFile', uri);
              return { uri, content };
            } catch (error) {
              console.error(`Failed to read file ${uri}:`, error);
              return { uri, content: '' };
            }
          });
          const results = await Promise.all(promises);
          for (const { uri, content } of results) {
            result.set(uri, content);
          }
        }
      }
    }

    return result;
  }

  async readDirectories(uriStrings: string[]): Promise<Map<string, FileTuple[]>> {
    // Group URIs by scheme
    const urisByScheme = new Map<string, string[]>();
    for (const uriString of uriStrings) {
      const uri = URI.parse(uriString);
      const scheme = uri.scheme;
      if (!urisByScheme.has(scheme)) {
        urisByScheme.set(scheme, []);
      }
      urisByScheme.get(scheme)!.push(uriString);
    }

    const result = new Map<string, FileTuple[]>();

    // Process each scheme group
    for (const [scheme, uris] of urisByScheme) {
      const fs = this.fileSystems[scheme];

      if (fs && fs.readDirectories) {
        // Use batch method if available
        const batchResult = await fs.readDirectories(uris);
        for (const [uri, files] of batchResult) {
          result.set(uri, files);
        }
      } else if (fs) {
        // Fall back to individual reads for this scheme
        const promises = uris.map(async (uri) => {
          try {
            const files = await fs.readDirectory(uri);
            return { uri, files };
          } catch (error) {
            console.error(`Failed to read directory ${uri}:`, error);
            return { uri, files: [] };
          }
        });
        const results = await Promise.all(promises);
        for (const { uri, files } of results) {
          result.set(uri, files);
        }
      } else {
        // Use batch IPC call to VSCode
        try {
          const batchResult = await this.connection.sendRequest('fs/readDirectories', uris);
          if (batchResult instanceof Map) {
            for (const [uri, files] of batchResult) {
              result.set(uri, files);
            }
          } else {
            // Fallback to individual IPC calls
            const promises = uris.map(async (uri) => {
              try {
                const files = await this.connection.sendRequest('fs/readDirectory', uri);
                return { uri, files };
              } catch (error) {
                console.error(`Failed to read directory ${uri}:`, error);
                return { uri, files: [] };
              }
            });
            const results = await Promise.all(promises);
            for (const { uri, files } of results) {
              result.set(uri, files);
            }
          }
        } catch (error) {
          // If batch request fails, fall back to individual requests
          const promises = uris.map(async (uri) => {
            try {
              const files = await this.connection.sendRequest('fs/readDirectory', uri);
              return { uri, files };
            } catch (error) {
              console.error(`Failed to read directory ${uri}:`, error);
              return { uri, files: [] };
            }
          });
          const results = await Promise.all(promises);
          for (const { uri, files } of results) {
            result.set(uri, files);
          }
        }
      }
    }

    return result;
  }
}
