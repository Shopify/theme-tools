import {
  AbstractFileSystem,
  path,
  recursiveReadDirectory,
  SectionSchema,
  SourceCodeType,
  ThemeBlockSchema,
} from '@shopify/theme-check-common';
import {
  buildThemeGraph,
  getWebComponentMap,
  IDependencies as GraphDependencies,
  Location,
  toSourceCode,
  WebComponentMap,
} from '@shopify/theme-graph';
import { Range } from 'vscode-json-languageservice';
import { Connection } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../documents';
import { AugmentedLocation, AugmentedReference, ThemeGraphDidUpdateNotification } from '../types';
import { debounce } from '../utils';

export class ThemeGraphManager {
  graphs: Map<string, ReturnType<typeof buildThemeGraph>> = new Map();

  constructor(
    private connection: Connection,
    private documentManager: DocumentManager,
    private fs: AbstractFileSystem,
    private findThemeRootURI: (uri: string) => Promise<string>,
  ) {}

  async getThemeGraphForURI(uri: string) {
    const rootUri = await this.findThemeRootURI(uri);
    if (!this.graphs.has(rootUri)) {
      const { documentManager } = this;
      await documentManager.preload(rootUri);

      const webComponentDefs = await this.getWebComponentMap(rootUri);
      const dependencies = this.graphDependencies(rootUri, webComponentDefs);

      this.graphs.set(rootUri, buildThemeGraph(rootUri, dependencies));
    }

    return this.graphs.get(rootUri);
  }

  async getReferences(uri: string, offset?: number, { includeIndirect = true } = {}) {
    const graph = await this.getThemeGraphForURI(uri);
    if (!graph) return [];

    let refs = graph.modules[uri]?.references ?? [];
    if (includeIndirect === false) {
      refs = refs.filter((ref) => ref.indirect === false);
    }
    return Promise.all(
      refs.map(async (ref) => {
        const [source, target] = await Promise.all([
          this.augmentedLocation(ref.source),
          this.augmentedLocation(ref.target),
        ]);
        return {
          ...ref,
          source: source,
          target: target,
        } as AugmentedReference;
      }),
    );
  }

  async getDependencies(uri: string, offset?: number, { includeIndirect = true } = {}) {
    const graph = await this.getThemeGraphForURI(uri);
    if (!graph) return [];

    let deps = graph.modules[uri]?.dependencies ?? [];
    if (includeIndirect === false) {
      deps = deps.filter((dep) => dep.indirect === false);
    }
    return Promise.all(
      deps.map(async (dep) => {
        const [source, target] = await Promise.all([
          this.augmentedLocation(dep.source),
          this.augmentedLocation(dep.target),
        ]);
        return {
          ...dep,
          source: source,
          target: target,
        } as AugmentedReference;
      }),
    );
  }

  async augmentedLocation(loc: Location): Promise<AugmentedLocation> {
    const sourceCode = await this.getSourceCode(loc.uri);
    const { uri, range } = loc;
    if (!sourceCode || !range) return loc as AugmentedLocation;

    let doc = this.documentManager.get(loc.uri)?.textDocument;
    if (!doc) {
      doc = TextDocument.create(sourceCode.uri, sourceCode.type, 0, sourceCode.source);
    }

    return {
      uri: uri,
      range: range,
      excerpt: sourceCode.source.slice(range[0], range[1]),
      position: Range.create(doc.positionAt(range[0]), doc.positionAt(range[0])),
    };
  }

  async deadCode(rootUri: string): Promise<string[]> {
    const graph = await this.getThemeGraphForURI(rootUri);
    if (!graph) return [];

    const files = await recursiveReadDirectory(
      this.fs,
      rootUri,
      ([uri]) =>
        ['assets', 'blocks', 'layout', 'sections', 'snippets', 'templates'].some((dir) =>
          uri.startsWith(path.join(rootUri, dir)),
        ) &&
        (uri.endsWith('.liquid') ||
          uri.endsWith('.json') ||
          uri.endsWith('.js') ||
          uri.endsWith('.css')),
    );

    const unusedFiles = new Set<string>();
    for (const file of files) {
      if (!graph.modules[file]) {
        unusedFiles.add(file);
      }
    }

    return Array.from(unusedFiles).sort();
  }

  public operationQueue: string[] = [];

  async rename(oldUri: string, newUri: string) {
    this.operationQueue.push(oldUri);
    this.operationQueue.push(newUri);
    this.processQueue();
  }

  async change(uri: string) {
    this.operationQueue.push(uri);
    this.processQueue();
  }

  async create(uri: string) {
    this.operationQueue.push(uri);
    this.processQueue();
  }

  async delete(uri: string) {
    this.operationQueue.push(uri);
    this.processQueue();
  }

  private processQueue = debounce(async () => {
    const operations = [...new Set(this.operationQueue.splice(0, this.operationQueue.length))];
    if (operations.length === 0) return;

    const anyUri = operations[0];
    const rootUri = await this.findThemeRootURI(anyUri);
    const graph = this.graphs.get(rootUri);
    if (!graph) return;

    this.graphs.delete(rootUri);
    await this.getThemeGraphForURI(rootUri);
    this.connection.sendNotification(ThemeGraphDidUpdateNotification.type, { uri: rootUri });
  }, 500);

  private getSourceCode = async (uri: string) => {
    const doc = this.documentManager.get(uri);
    if (doc) return doc;

    const source = await this.fs.readFile(uri);
    return toSourceCode(uri, source);
  };

  private getWebComponentMap(rootUri: string): Promise<WebComponentMap> {
    const { fs, getSourceCode } = this;
    return getWebComponentMap(rootUri, { fs, getSourceCode });
  }

  private graphDependencies(rootUri: string, webComponentDefs: WebComponentMap): GraphDependencies {
    const { documentManager, fs, getSourceCode } = this;
    return {
      fs: fs,
      getSourceCode: getSourceCode,
      async getBlockSchema(name: string) {
        const blockUri = path.join(rootUri, 'blocks', `${name}.liquid`);
        const doc = documentManager.get(blockUri);
        if (!doc || doc.type !== SourceCodeType.LiquidHtml) {
          return;
        }
        return (await doc.getSchema()) as ThemeBlockSchema;
      },
      async getSectionSchema(name) {
        const sectionUri = path.join(rootUri, 'sections', `${name}.liquid`);
        const doc = documentManager.get(sectionUri);
        if (!doc || doc.type !== SourceCodeType.LiquidHtml) {
          return;
        }
        return (await doc.getSchema()) as SectionSchema;
      },
      getWebComponentDefinitionReference(customElementName: string) {
        return webComponentDefs.get(customElementName);
      },
    };
  }
}
