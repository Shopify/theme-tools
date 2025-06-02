import {
  AbstractFileSystem,
  path,
  SectionSchema,
  SourceCodeType,
  ThemeBlockSchema,
} from '@shopify/theme-check-common';
import {
  buildThemeGraph,
  getWebComponentMap,
  Dependencies as GraphDependencies,
  toSourceCode,
  Location,
  Reference,
} from '@shopify/theme-graph';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentManager } from '../documents';
import { Range } from 'vscode-json-languageservice';

export class ThemeGraphManager {
  graphs: Map<string, ReturnType<typeof buildThemeGraph>> = new Map();

  constructor(
    private documentManager: DocumentManager,
    private fs: AbstractFileSystem,
    private findThemeRootURI: (uri: string) => Promise<string>,
  ) {}

  private getSourceCode = async (uri: string) => {
    const doc = this.documentManager.get(uri);
    if (doc) return doc;

    const source = await this.fs.readFile(uri);
    return toSourceCode(uri, source);
  };

  async getThemeGraphForURI(uri: string) {
    const rootUri = await this.findThemeRootURI(uri);
    if (!this.graphs.has(rootUri)) {
      const { fs, documentManager, getSourceCode } = this;

      const webComponentDefs = await getWebComponentMap(rootUri, { fs, getSourceCode });
      const dependencies: GraphDependencies = {
        fs: this.fs,
        getSourceCode: this.getSourceCode,
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
