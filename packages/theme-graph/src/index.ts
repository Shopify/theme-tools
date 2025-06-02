import { NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
import {
  JSONNode,
  JSONSourceCode,
  LiquidSourceCode,
  memo,
  memoize,
  nodeAtPath,
  ObjectNode,
  parseJSON,
  path,
  PropertyNode,
  recursiveReadDirectory,
  SectionSchema,
  SourceCodeType,
  Template,
  ThemeBlockSchema,
  Dependencies as ThemeCheckDependencies,
  UriString,
  visit,
  Visitor,
} from '@shopify/theme-check-common';
import { toSourceCode } from './toSourceCode';
import { CssSourceCode, JsSourceCode } from './types';
import { assertNever, unique } from './utils';

export { toSourceCode, toCssSourceCode, toJsSourceCode } from './toSourceCode';
export { getWebComponentMap } from './getWebComponentMap';

export interface IDependencies {
  fs: ThemeCheckDependencies['fs'];

  /**
   * Asynchronously get the block schema for 'blocks/${name}.liquid'
   * May return undefined when the theme isn't preloaded.
   * See {@link ThemeBlockSchema} for more information
   */
  getBlockSchema: NonNullable<ThemeCheckDependencies['getBlockSchema']>;

  /**
   * Asynchronously get the section schema for 'section/${name}.liquid'
   * May return undefined when the theme isn't preloaded or if there are none.
   * See {@link SectionSchema} for more information
   */
  getSectionSchema: NonNullable<ThemeCheckDependencies['getSectionSchema']>;

  /** Optional perf improvement if you somehow have access to pre-computed source code info */
  getSourceCode?: (
    uri: UriString,
  ) => Promise<JSONSourceCode | LiquidSourceCode | JsSourceCode | CssSourceCode>;

  /** A way to link <custom-element> to its window.customElements.define statement */
  getWebComponentDefinitionReference: (
    customElementName: string,
  ) => { assetName: string; range: Range } | undefined;
}

export type Dependencies = Required<IDependencies>;

type AugmentedDependencies = Dependencies & {
  getThemeBlockNames: () => Promise<string[]>;
};

export interface ThemeGraph {
  entryPoints: ThemeModule[];
  modules: Record<UriString, ThemeModule>;
  rootUri: string;
}

export type Range = [start: number, end: number]; // represents a range in the source code

/**
 * A reference is a link between two modules.
 *
 * @example
 *
 * It could be a specific range that points to a whole file
 * {
 *   source: { uri: 'file:///templates/index.json', range: [167, 190] },
 *   target: 'file:///sections/custom-section.liquid'
 * }
 *
 * It could be a specific range that points to a specific range
 * {
 *   // e.g. `<parent-component></parent-component>`
 *   source: { uri: 'file:///snippets/parent.liquid', range: [167, 190] },
 *
 *   // e.g. window.customElements.define('parent-component', ParentComponent);
 *   target: { uri: 'file:///assets/theme.js', range: [0, undefined] }
 * }
 */
export type Reference = {
  source: Location;
  target: Location;

  /** An indirect reference is for things like a blocks' dependency on "@theme" blocks */
  indirect: boolean;
};

export type Location = {
  /** The URI of the module */
  uri: UriString;
  /** Optional range inside that module */
  range?: Range;
};

export type IThemeModule<T extends ModuleType> = T extends ModuleType
  ? {
      /** Used as a discriminant in the ThemeNode union */
      type: T;

      /** Should be normalized. Used as key. */
      uri: UriString;

      /**
       * Outgoing references to other modules. e.g. {% render 'child' %} from parent
       *
       * The source URI of all dependencies is this module.
       */
      dependencies: Reference[];

      /**
       * Ingoing references from other modules. e.g. {% render 'child' %} in parent
       *
       * The target URI of all dependencies is this module.
       */
      references: Reference[];
    }
  : never;

export const enum ModuleType {
  Liquid = 'Liquid',
  JavaScript = 'JavaScript',
  Json = 'JSON',
  Css = 'CSS',
}

export const enum JsonModuleKind {
  /** templates/*.json files */
  Template = 'template',

  /** sections/*.json files */
  SectionGroup = 'section-group',
}

export const enum LiquidModuleKind {
  /** layout/*.liquid files */
  Layout = 'layout',

  /** sections/*.liquid files */
  Section = 'section',

  /** blocks/*.liquid files */
  Block = 'block',

  /** snippets/*.liquid files */
  Snippet = 'snippet',

  /** templates/*.liquid files (forgot those existed...) */
  Template = 'template',
}

export interface LiquidModule extends IThemeModule<ModuleType.Liquid> {
  kind: `${LiquidModuleKind}`;
}

export interface JsonModule extends IThemeModule<ModuleType.Json> {
  kind: JsonModuleKind;
}

/**
 * JS Modules can only have JS deps
 * JS Modules can only be required by Liquid or JS files
 */
export interface JavaScriptModule extends IThemeModule<ModuleType.JavaScript> {
  kind: 'unused';
}

/**
 * CSS Modules can only have CSS deps
 * CSS Modules can only be required by Liquid or CSS files
 */
export interface CssModule extends IThemeModule<ModuleType.Css> {
  kind: 'unused';
}

export type ThemeModule = LiquidModule | JsonModule | JavaScriptModule | CssModule;

export interface SerializableEdge {
  source: Location;
  target: Location;
}

export type SerializableNode = Pick<ThemeModule, 'uri' | 'type' | 'kind'>;

export interface SerializableGraph {
  rootUri: UriString;
  nodes: SerializableNode[];
  edges: SerializableEdge[];
}

export function serializeThemeGraph(graph: ThemeGraph): SerializableGraph {
  const nodes: SerializableNode[] = Object.values(graph.modules).map((module) => ({
    uri: module.uri,
    type: module.type,
    kind: module.kind,
  }));

  const edges: SerializableEdge[] = Object.values(graph.modules).flatMap(
    (module) => module.dependencies,
  );

  return {
    rootUri: graph.rootUri,
    nodes,
    edges,
  };
}

const identity = <T>(x: T): T => x;

export async function buildThemeGraph(
  rootUri: UriString,
  ideps: IDependencies,
): Promise<ThemeGraph> {
  const deps: AugmentedDependencies = {
    fs: ideps.fs,
    getBlockSchema: memoize(ideps.getBlockSchema, identity),
    getSectionSchema: memoize(ideps.getSectionSchema, identity),

    // parse at most once
    getSourceCode: memoize(
      ideps.getSourceCode ??
        async function defaultGetSourceCode(uri) {
          const contents = await ideps.fs.readFile(uri);
          return toSourceCode(uri, contents);
        },
      identity,
    ),

    getWebComponentDefinitionReference: ideps.getWebComponentDefinitionReference,
    getThemeBlockNames: memo(() => {
      return recursiveReadDirectory(ideps.fs, path.join(rootUri, 'blocks'), ([fileUri]) =>
        fileUri.endsWith('.liquid'),
      );
    }),
  };

  const entryPoints = await recursiveReadDirectory(deps.fs, rootUri, ([fileUri]) =>
    fileUri.startsWith(path.join(rootUri, 'templates')),
  );
  const themeGraph: ThemeGraph = {
    entryPoints: [],
    modules: {},
    rootUri,
  };

  themeGraph.entryPoints = entryPoints.map((entryUri) => getTemplateModule(themeGraph, entryUri));

  await Promise.all(themeGraph.entryPoints.map((entry) => traverseModule(entry, themeGraph, deps)));

  return themeGraph;
}

export function getTemplateModule(themeGraph: ThemeGraph, uri: UriString): ThemeModule {
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri];
  }

  const extension = extname(uri);
  switch (extension) {
    case 'json': {
      return {
        type: ModuleType.Json,
        kind: JsonModuleKind.Template,
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    case 'liquid': {
      return {
        type: ModuleType.Liquid,
        kind: LiquidModuleKind.Template,
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    default: {
      throw new Error(`Unknown template type for ${uri}`);
    }
  }
}

export function getThemeBlockModule(themeGraph: ThemeGraph, blockType: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'blocks', `${blockType}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }

  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Block,
    dependencies: [],
    references: [],
    uri,
  };
}

export function getSectionModule(themeGraph: ThemeGraph, sectionType: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'sections', `${sectionType}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }

  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Section,
    dependencies: [],
    references: [],
    uri,
  };
}

export function getSectionGroupModule(
  themeGraph: ThemeGraph,
  sectionGroupType: string,
): JsonModule {
  const uri = path.join(themeGraph.rootUri, 'sections', `${sectionGroupType}.json`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as JsonModule;
  }

  return {
    type: ModuleType.Json,
    kind: JsonModuleKind.SectionGroup,
    dependencies: [],
    references: [],
    uri,
  };
}

export function getAssetModule(
  themeGraph: ThemeGraph,
  asset: string,
): JavaScriptModule | CssModule | undefined {
  // return undefined;
  const extension = extname(asset);
  switch (extension) {
    case 'js': {
      const uri = path.join(themeGraph.rootUri, 'assets', asset);
      if (themeGraph.modules[uri]) {
        return themeGraph.modules[uri] as JavaScriptModule;
      }

      return {
        type: ModuleType.JavaScript,
        kind: 'unused',
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    case 'css': {
      const uri = path.join(themeGraph.rootUri, 'assets', asset);
      if (themeGraph.modules[uri]) {
        return themeGraph.modules[uri] as CssModule;
      }

      return {
        type: ModuleType.Css,
        kind: 'unused',
        dependencies: [],
        references: [],
        uri: uri,
      };
    }

    default: {
      return undefined;
    }
  }
}

export function getSnippetModule(themeGraph: ThemeGraph, snippet: string): LiquidModule {
  const uri = path.join(themeGraph.rootUri, 'snippets', `${snippet}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }
  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Snippet,
    uri: uri,
    dependencies: [],
    references: [],
  };
}

export function getLayoutModule(
  themeGraph: ThemeGraph,
  layoutName: string | false | undefined = 'theme',
): LiquidModule | undefined {
  if (layoutName === false) return undefined;
  if (layoutName === undefined) layoutName = 'theme';
  const uri = path.join(themeGraph.rootUri, 'layout', `${layoutName}.liquid`);
  if (themeGraph.modules[uri]) {
    return themeGraph.modules[uri] as LiquidModule;
  }

  return {
    type: ModuleType.Liquid,
    kind: LiquidModuleKind.Layout,
    uri: uri,
    dependencies: [],
    references: [],
  };
}

export type Void = void | Void[];

async function traverseModule(
  module: ThemeModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  // If the module is already traversed, skip it
  if (themeGraph.modules[module.uri]) {
    return;
  }

  themeGraph.modules[module.uri] = module;

  switch (module.type) {
    case ModuleType.Liquid: {
      return traverseLiquidModule(module, themeGraph, deps);
    }

    case ModuleType.Json: {
      return traverseJsonModule(module, themeGraph, deps);
    }

    case ModuleType.JavaScript: {
      return; // TODO graph import/exports ?
    }

    case ModuleType.Css: {
      return; // Nothing to do??
    }

    default: {
      return assertNever(module);
    }
  }
}

async function traverseLiquidModule(
  module: LiquidModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
) {
  const sourceCode = await deps.getSourceCode(module.uri);

  if (sourceCode.ast instanceof Error) return; // can't visit what you can't parse

  const visitor: Visitor<
    SourceCodeType.LiquidHtml,
    { target: ThemeModule; sourceRange: Range; targetRange?: Range }
  > = {
    // {{ 'theme.js' | asset_url }}
    // {{ 'theme.css' | asset_url }}
    LiquidFilter: (node, ancestors) => {
      if (node.name === 'asset_url') {
        const parentNode = ancestors[ancestors.length - 1]!;
        if (parentNode.type !== NodeTypes.LiquidVariable) return;
        if (parentNode.expression.type !== NodeTypes.String) return;
        if (parentNode.filters[0] !== node) return;
        const asset = parentNode.expression.value;
        const module = getAssetModule(themeGraph, asset);
        if (!module) return;
        return {
          target: module,
          sourceRange: [parentNode.position.start, parentNode.position.end],
        };
      }
    },

    // {% content_for 'block', type: 'staticBlockName', id: 'id' %}
    ContentForMarkup: (node, ancestors) => {
      const parentNode = ancestors.at(-1)!;
      if (node.contentForType.value !== 'block') return;
      const blockTypeArg = node.args.find((arg) => arg.name === 'type');
      if (!blockTypeArg) return;

      const blockTypeValue = blockTypeArg.value;
      if (blockTypeValue.type !== NodeTypes.String) return;

      const blockType = blockTypeValue.value;

      return {
        target: getThemeBlockModule(themeGraph, blockType),
        sourceRange: [parentNode.position.start, node.position.end],
      };
    },

    // <custom-element></custom-element>
    HtmlElement: (node) => {
      if (node.name.length !== 1) return;
      if (node.name[0].type !== NodeTypes.TextNode) return;
      const nodeNameNode = node.name[0];
      const nodeName = nodeNameNode.value;
      if (!nodeName.includes('-')) return; // skip non-custom-elements

      const result = deps.getWebComponentDefinitionReference(nodeName);
      if (!result) return;
      const { assetName, range } = result;
      const module = getAssetModule(themeGraph, assetName);
      if (!module) return;

      return {
        target: module,
        sourceRange: [node.blockStartPosition.start, nodeNameNode.position.end],
        targetRange: range,
      };
    },

    // {% render 'snippet' %}
    RenderMarkup: (node, ancestors) => {
      const snippet = node.snippet;
      const tag = ancestors.at(-1)!;
      if (!isString(snippet) && snippet.type === NodeTypes.String) {
        return {
          target: getSnippetModule(themeGraph, snippet.value),
          sourceRange: [tag.position.start, tag.position.end],
        };
      }
    },

    LiquidTag: (node) => {
      switch (node.name) {
        // {% sections 'section-group' %}
        case NamedTags.sections: {
          if (!isString(node.markup)) {
            const sectionGroupType = node.markup.value;
            return {
              target: getSectionGroupModule(themeGraph, sectionGroupType),
              sourceRange: [node.position.start, node.position.end],
            };
          }
        }

        // {% section 'section' %}
        case NamedTags.section: {
          if (!isString(node.markup)) {
            const sectionType = node.markup.value;
            return {
              target: getSectionModule(themeGraph, sectionType),
              sourceRange: [node.position.start, node.position.end],
            };
          }
        }
      }
    },
  };

  const references = visit(sourceCode.ast, visitor);

  for (const reference of references) {
    bind(module, reference.target, {
      sourceRange: reference.sourceRange,
      targetRange: reference.targetRange,
    });
  }

  const modules = unique(references.map((ref) => ref.target));
  const promises = modules.map((mod) => traverseModule(mod, themeGraph, deps));

  // Look at schema references if any
  if (module.kind === LiquidModuleKind.Section) {
    const sectionName = path.basename(module.uri, '.liquid');
    const sectionSchema = await deps.getSectionSchema(sectionName);
    promises.push(traverseLiquidSchema(sectionSchema, module, themeGraph, deps));
  } else if (module.kind === LiquidModuleKind.Block) {
    const blockName = path.basename(module.uri, '.liquid');
    const blockSchema = await deps.getBlockSchema(blockName);
    promises.push(traverseLiquidSchema(blockSchema, module, themeGraph, deps));
  }

  return Promise.all(promises);
}

async function traverseLiquidSchema(
  schema: SectionSchema | ThemeBlockSchema | undefined,
  module: LiquidModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  if (!schema) return;

  const isSection = module.kind === LiquidModuleKind.Section;
  const hasLocalBlocks =
    isSection && (await acceptsLocalBlocks(path.basename(module.uri, '.liquid'), deps));
  if (hasLocalBlocks) return;

  const { ast, validSchema } = schema;
  if (validSchema instanceof Error || ast instanceof Error) return;

  const promises: Promise<Void>[] = [];

  // Traverse the blocks
  if (validSchema.blocks) {
    for (const [i, blockDef] of Object.entries(validSchema.blocks)) {
      const nodePath = ['blocks', i];
      const node = nodeAtPath(ast, nodePath)! as ObjectNode;
      const typeProperty = node.children.find((child) => child.key.value === 'type');
      if (!typeProperty) continue;

      const sourceRange: Range = [
        schema.offset + typeProperty.loc.start.offset,
        schema.offset + typeProperty.loc.end.offset,
      ];

      switch (blockDef.type) {
        case '@theme': {
          const publicBlocks = await deps
            .getThemeBlockNames()
            .then((blocks) => blocks.filter((b) => !path.basename(b).startsWith('_')));
          for (const publicBlock of publicBlocks) {
            const blockModule = getThemeBlockModule(
              themeGraph,
              path.basename(publicBlock, '.liquid'),
            );
            bind(module, blockModule, { sourceRange, indirect: true });
            promises.push(traverseModule(blockModule, themeGraph, deps));
          }

          break;
        }

        case '@app': {
          break;
        }

        default: {
          const blockModule = getThemeBlockModule(themeGraph, blockDef.type);
          bind(module, blockModule, { sourceRange });
          promises.push(traverseModule(blockModule, themeGraph, deps));
        }
      }
    }
  }

  return Promise.all(promises);
}

async function traverseJsonModule(
  module: JsonModule,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  const sourceCode = await deps.getSourceCode(module.uri);
  if (sourceCode.type !== SourceCodeType.JSON) throw unexpected();
  const ast = sourceCode.ast;
  if (ast instanceof Error) return; // can't visit what you can't parse

  switch (module.kind) {
    case JsonModuleKind.Template: {
      // Should only happen once per template
      const template = parseJSON(sourceCode.source) as Template.Template;
      const promises: Promise<Void>[] = [];
      for (const [key, section] of Object.entries(template.sections)) {
        const sectionType = section.type;
        const path = ['sections', key];
        const node = nodeAtPath(ast, path)! as ObjectNode;
        const sectionModule = getSectionModule(themeGraph, sectionType);
        const typeProperty = node.children.find((child) => child.key.value === 'type')!;
        const start = typeProperty.loc.start.offset;
        const end = typeProperty.loc.end.offset;
        const sourceRange: Range = [start, end];
        // Link the template to the section
        bind(module, sectionModule, { sourceRange });
        promises.push(
          // Traverse the section themeselves
          traverseModule(sectionModule, themeGraph, deps),
          // Link the blocks used in the section to the template
          traverseSectionReferences(module, ast, path, section, themeGraph, deps),
        );
      }

      // Link the template to the layout
      const layout = template.layout;
      const layoutModule = getLayoutModule(themeGraph, template.layout);
      if (layoutModule) {
        let sourceRange: Range | undefined = undefined;
        let indirect = true;
        if (layout !== false && layout !== undefined) {
          const layoutPath = ['layout'];
          const node = nodeAtPath(ast, layoutPath)!;
          sourceRange = [node.loc.start.offset, node.loc.end.offset];
          indirect = false; // this is a direct reference to the layout
        }
        bind(module, layoutModule, { sourceRange, indirect });
        promises.push(traverseModule(layoutModule, themeGraph, deps));
      }

      return Promise.all(promises);
    }

    case JsonModuleKind.SectionGroup: {
      const sectionGroup = parseJSON(sourceCode.source) as Template.SectionGroup;
      const promises: Promise<Void>[] = [];
      for (const [key, section] of Object.entries(sectionGroup.sections)) {
        const sectionType = section.type;
        const path = ['sections', key];
        const node = nodeAtPath(ast, path)! as ObjectNode;
        const sectionModule = getSectionModule(themeGraph, sectionType);

        const typeProperty = node.children.find((child) => child.key.value === 'type')!;
        const start = typeProperty.loc.start.offset;
        const end = typeProperty.loc.end.offset;
        const sourceRange: Range = [start, end];

        // Link the template to the section
        bind(module, sectionModule, { sourceRange });
        promises.push(
          // Traverse the section themeselves
          traverseModule(sectionModule, themeGraph, deps),
          // Link the blocks used in the section to the template
          traverseSectionReferences(module, ast, path, section, themeGraph, deps),
        );
      }

      return Promise.all(promises);
    }

    default: {
      return assertNever(module.kind);
    }
  }
}

/**
 * Traverses the actual references contained inside Template.Template['sections'] and Template.SectionGroup['sections'].
 *
 * Does nothing if the mode is not `GraphMode.Production`.
 */
async function traverseSectionReferences(
  source: ThemeModule, // template or section group
  sourceAst: JSONNode,
  nodePath: string[] = [],
  section: Template.Section,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  if (!section.blocks) return;
  const sectionHasLocalBlocks = await acceptsLocalBlocks(section.type, deps);
  if (sectionHasLocalBlocks) return;

  const promises: Promise<Void>[] = [];

  for (const [key, block] of Object.entries(section.blocks)) {
    const blockType = block.type;
    const blockModule = getThemeBlockModule(themeGraph, blockType);
    const path = [...nodePath, 'blocks', key];
    const node = nodeAtPath(sourceAst, path)! as ObjectNode;
    const typeProperty = node.children.find((child) => child.key.value === 'type')!;
    const start = typeProperty.loc.start.offset;
    const end = typeProperty.loc.end.offset;
    const sourceRange: Range = [start, end];
    // Link the template to the block
    bind(source, blockModule, { sourceRange });
    promises.push(
      // Traverse the block themselves
      traverseModule(blockModule, themeGraph, deps),
      // Traverse the block references
      traverseBlockReferences(source, sourceAst, path, block, themeGraph, deps),
    );
  }

  return Promise.all(promises);
}

async function traverseBlockReferences(
  source: ThemeModule, // template or section group
  sourceAst: JSONNode,
  nodePath: string[] = [],
  block: Template.Block,
  themeGraph: ThemeGraph,
  deps: AugmentedDependencies,
): Promise<Void> {
  if (!block.blocks) return;

  const promises: Promise<Void>[] = [];
  for (const [key, childBlock] of Object.entries(block.blocks)) {
    const childBlockType = childBlock.type;
    const childBlockModule = getThemeBlockModule(themeGraph, childBlockType);
    const path = [...nodePath, 'blocks', key];
    const node = nodeAtPath(sourceAst, path)! as ObjectNode;
    const typeProperty = node.children.find((child) => child.key.value === 'type')!;
    const start = typeProperty.loc.start.offset;
    const end = typeProperty.loc.end.offset;
    const sourceRange: Range = [start, end];
    // Link the template/section group to the block
    bind(source, childBlockModule, { sourceRange });
    promises.push(
      // Traverse the child block themselves
      traverseModule(childBlockModule, themeGraph, deps),
      // Traverse the child block references
      traverseBlockReferences(source, sourceAst, path, childBlock, themeGraph, deps),
    );
  }

  return Promise.all(promises);
}

export function bind(
  source: ThemeModule,
  target: ThemeModule,
  {
    sourceRange,
    targetRange,
    indirect = false,
  }: {
    sourceRange?: Range; // a range in the source module that references the child
    targetRange?: Range; // a range in the child module that is being referenced
    indirect?: boolean; // if true, the source is not directly referencing the target (e.g. @theme dependency)
  } = {},
): void {
  const dependency: Reference = {
    source: { uri: source.uri, range: sourceRange },
    target: { uri: target.uri, range: targetRange },
    indirect,
  };

  source.dependencies.push(dependency);
  target.references.push(dependency);
}

function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function extname(uri: UriString): string {
  return uri.split('.').pop() || '';
}

async function acceptsLocalBlocks(
  sectionType: string,
  deps: AugmentedDependencies,
): Promise<boolean | Error> {
  const sectionSchema = await deps.getSectionSchema(sectionType);
  if (!sectionSchema) {
    return new Error('Section does not exist');
  }

  const validSchema = sectionSchema.validSchema;
  if (validSchema instanceof Error) {
    return validSchema;
  }

  return (validSchema.blocks ?? []).some((block) => {
    return block.type && 'name' in block && block.name;
  });
}

function unexpected(): Error {
  return new Error('Unexpected code path encountered');
}
