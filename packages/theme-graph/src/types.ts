import {
  JSONSourceCode,
  LiquidSourceCode,
  Dependencies as ThemeCheckDependencies,
  UriString,
} from '@shopify/theme-check-common';
import { Program } from 'acorn';

export interface IDependencies {
  fs: ThemeCheckDependencies['fs'];

  /**
   * Asynchronously get the block schema for 'blocks/${name}.liquid'
   * May return undefined when the theme isn't preloaded.
   */
  getBlockSchema: NonNullable<ThemeCheckDependencies['getBlockSchema']>;

  /**
   * Asynchronously get the section schema for 'section/${name}.liquid'
   * May return undefined when the theme isn't preloaded or if there are none.
   */
  getSectionSchema: NonNullable<ThemeCheckDependencies['getSectionSchema']>;

  /** Optional perf improvement if you somehow have access to pre-computed source code info */
  getSourceCode?: (uri: UriString) => Promise<FileSourceCode>;

  /** A way to link <custom-element> to its window.customElements.define statement */
  getWebComponentDefinitionReference: (
    customElementName: string,
  ) => { assetName: string; range: Range } | undefined;
}

export type Dependencies = Required<IDependencies>;

export type AugmentedDependencies = Dependencies & {
  getThemeBlockNames: () => Promise<string[]>;
};

export interface ThemeGraph {
  rootUri: UriString;
  entryPoints: ThemeModule[];
  modules: Record<UriString, ThemeModule>;
}

export type ThemeModule =
  | LiquidModule
  | JsonModule
  | JavaScriptModule
  | CssModule
  | SvgModule
  | ImageModule;

export type FileSourceCode =
  | LiquidSourceCode
  | JSONSourceCode
  | JsSourceCode
  | CssSourceCode
  | SvgSourceCode
  | ImageSourceCode;

export interface SerializableGraph {
  rootUri: UriString;
  nodes: SerializableNode[];
  edges: SerializableEdge[];
}

export interface SerializableEdge {
  source: Location;
  target: Location;
}

export type SerializableNode = Pick<ThemeModule, 'uri' | 'type' | 'kind' | 'exists'>;

export interface LiquidModule extends IThemeModule<ModuleType.Liquid> {
  kind: LiquidModuleKind;
}

export interface JsonModule extends IThemeModule<ModuleType.Json> {
  kind: JsonModuleKind;
}

export interface JavaScriptModule extends IThemeModule<ModuleType.JavaScript> {
  kind: 'unused';
}

export interface CssModule extends IThemeModule<ModuleType.Css> {
  kind: 'unused';
}

export interface SvgModule extends IThemeModule<ModuleType.Svg> {
  kind: 'unused';
}

export interface ImageModule extends IThemeModule<ModuleType.Image> {
  kind: 'unused';
}

export interface IThemeModule<T extends ModuleType> {
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

  /**
   * Since you could have files that depend on files that don't exist,
   *
   * this property will be used to quickly identify those.
   */
  exists?: boolean;
}

export const enum ModuleType {
  Liquid = 'Liquid',
  JavaScript = 'JavaScript',
  Json = 'JSON',
  Css = 'CSS',
  Svg = 'SVG',
  Image = 'Image',
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

export const SUPPORTED_ASSET_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
  'ico',
];

export interface CssSourceCode {
  type: 'css';
  uri: UriString;
  source: string;
  ast: any | Error;
}

export interface SvgSourceCode {
  type: 'svg';
  uri: UriString;
  source: string;
  ast: any | Error;
}

export interface ImageSourceCode {
  type: 'image';
  uri: UriString;
  source: string;
  ast: any | Error;
}

export interface JsSourceCode {
  type: 'javascript';
  uri: UriString;
  source: string;
  ast: Program | Error;
}

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

  type:
    | 'direct' // explicit dependency, e.g. {% render 'child' %}
    | 'indirect' // indirect dependency, e.g. "blocks": [{ "type": "@theme" }]
    | 'preset'; // preset dependency
};

export type Range = [start: number, end: number]; // represents a range in the source code
export type Location = {
  /** The URI of the module */
  uri: UriString;
  /** Optional range inside that module */
  range?: Range;
};

export type Void = void | Void[]; /** e.g. product-element, */

export type WebComponentMap = Map<WebComponentName, WebComponentDefinition>;
export type WebComponentName = string;
export type WebComponentDefinition = {
  assetName: string; // Relative path to the asset file
  range: [number, number]; // Start and end positions in the file
};
