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
  Operation,
  Reference,
  toSourceCode,
  WebComponentMap,
  updateThemeGraph,
  findWebComponentReferences,
} from '@shopify/theme-graph';
import { Range } from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../documents';
import { debounce } from '../utils';

export class ThemeGraphManager {
  graphs: Map<string, ReturnType<typeof buildThemeGraph>> = new Map();
  webComponentMaps: Map<string, Promise<WebComponentMap>> = new Map();

  constructor(
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

  public operationQueue: Operation[] = [];

  async rename(oldUri: string, newUri: string) {
    this.operationQueue.push({ type: 'rename', oldUri, newUri });
    this.processQueue();
  }

  async change(uri: string) {
    this.operationQueue.push({ type: 'change', uri });
    this.processQueue();
  }

  async create(uri: string) {
    this.operationQueue.push({ type: 'create', uri });
    this.processQueue();
  }

  async delete(uri: string) {
    this.operationQueue.push({ type: 'delete', uri });
    this.processQueue();
  }

  private processQueue = debounce(async () => {
    const operations = this.operationQueue
      .splice(0, this.operationQueue.length)
      .reduce(deduplicate, []);
    if (operations.length === 0) return;

    const anyUri = 'uri' in operations[0] ? operations[0].uri : operations[0].oldUri;
    const rootUri = await this.findThemeRootURI(anyUri);
    const graph = this.graphs.get(rootUri);
    if (!graph) return;

    const webComponentMap = await this.getWebComponentMap(rootUri);

    // TODO update the webcomponentMap correctly based on the operations
    // const jsFilesModified = operations.filter((op) =>
    //   op[('uri' in op ? 'uri' : 'newUri') as keyof typeof op].endsWith('.js'),
    // );
    // // Update the webComponentMap so that the ranges are correct
    // for (const op of jsFilesModified) {
    //   await findWebComponentReferences(
    //     op[('uri' in op ? 'uri' : 'newUri') as keyof typeof op],
    //     rootUri,
    //     this.getSourceCode,
    //     webComponentMap,
    //   );
    // }

    const dependencies = this.graphDependencies(rootUri, webComponentMap);

    // Assuming all operations are for the same root URI
    await updateThemeGraph(await graph, dependencies, operations);
  }, 500);

  private getSourceCode = async (uri: string) => {
    const doc = this.documentManager.get(uri);
    if (doc) return doc;

    const source = await this.fs.readFile(uri);
    return toSourceCode(uri, source);
  };

  private getWebComponentMap(rootUri: string): Promise<WebComponentMap> {
    if (!this.webComponentMaps.has(rootUri)) {
      const { fs, getSourceCode } = this;
      this.webComponentMaps.set(rootUri, getWebComponentMap(rootUri, { fs, getSourceCode }));
    }
    return this.webComponentMaps.get(rootUri)!;
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

export type AugmentedLocation =
  | {
      uri: string;
      range: undefined;
      excerpt: undefined;
      position: undefined;
    }
  | {
      uri: string;
      range: [number, number];
      excerpt: string;
      position: Range;
    };

export interface AugmentedReference extends Reference {
  source: AugmentedLocation;
  target: AugmentedLocation;
  indirect: boolean;
}

function deduplicate(acc: Operation[], op: Operation): Operation[] {
  const last = acc.at(-1);

  // Merge subsequent operations of the same type and uri
  if (last && last.type === op.type && 'uri' in last && 'uri' in op && last.uri === op.uri) {
    return acc;
  } else {
    // Add the operation to the queue
    acc.push(op);
    return acc;
  }
}
