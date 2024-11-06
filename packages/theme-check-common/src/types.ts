import { NodeTypes as LiquidHtmlNodeTypes, LiquidHtmlNode } from '@shopify/liquid-html-parser';

import {
  ArrayNode,
  IdentifierNode,
  LiteralNode,
  ObjectNode,
  PropertyNode,
  ASTNode,
} from 'json-to-ast';
import { Schema, Settings } from './types/schema-prop-factory';

import { StringCorrector, JSONCorrector } from './fixes';
import { AbstractFileSystem, UriString } from './AbstractFileSystem';

import { ThemeDocset, JsonValidationSet } from './types/theme-liquid-docs';

export * from './types/theme-liquid-docs';
export * from './types/schema-prop-factory';

export const isObjectNode = (node?: ASTNode): node is ObjectNode => node?.type === 'Object';
export const isArrayNode = (node?: ASTNode): node is ArrayNode => node?.type === 'Array';
export const isPropertyNode = (node?: ASTNode): node is PropertyNode => node?.type === 'Property';

export const Modes = ['theme', 'app'] as const;
export type Mode = (typeof Modes)[number];
export type Theme = SourceCode<SourceCodeType>[];

export type SourceCode<T = SourceCodeType> = T extends SourceCodeType
  ? {
      /** A normalized uri the file. */
      uri: string;
      /** The type is used as a discriminant for type narrowing */
      type: T;
      /** The version is used by the Language Server to make sure the Client and Server are in sync */
      version?: number;
      /** The contents of the file */
      source: string;
      /** The AST representation of the file, or an Error instance when the file is unparseable */
      ast: AST[T] | Error;
    }
  : never;

export enum SourceCodeType {
  JSON = 'JSON',
  LiquidHtml = 'LiquidHtml',
}

export type LiquidSourceCode = SourceCode<SourceCodeType.LiquidHtml>;
export type LiquidCheckDefinition<S extends Schema = Schema> = CheckDefinition<
  SourceCodeType.LiquidHtml,
  S
>;
export type LiquidCheck = Check<SourceCodeType.LiquidHtml>;

export { LiquidHtmlNodeTypes };
export { LiquidHtmlNode };

export type JSONSourceCode = SourceCode<SourceCodeType.JSON>;
export type JSONCheckDefinition<S extends Schema = Schema> = CheckDefinition<
  SourceCodeType.JSON,
  S
>;
export type JSONCheck = Check<SourceCodeType.JSON>;

export type JSONNodeTypes = 'Object' | 'Property' | 'Identifier' | 'Array' | 'Literal';

export type JSONNode = ArrayNode | IdentifierNode | LiteralNode | ObjectNode | PropertyNode;

// AST[SourceCodeType.LiquidHtml] maps to LiquidHtmlNode
export type AST = {
  [T in SourceCodeType]: {
    [SourceCodeType.JSON]: JSONNode;
    [SourceCodeType.LiquidHtml]: LiquidHtmlNode;
  }[T];
};

export type NodeTypes = {
  [T in SourceCodeType]: {
    [SourceCodeType.JSON]: JSONNodeTypes;
    [SourceCodeType.LiquidHtml]: LiquidHtmlNodeTypes;
  }[T];
};

/** A vscode-uri string. */
export type { UriString };

/** Assumes forward slashes for simplicity internally */
export type RelativePath = string;

export type ChecksSettings = {
  [code in string]?: CheckSettings;
};

export type CheckSettings = {
  enabled: boolean;
  severity?: Severity;
  ignore?: string[];
} & {
  [key in string]: any;
};

export interface Config {
  // I know, it's `context` in the config and `Mode` in the code...
  // We already have something named "Context" internally when you're writing a check.
  // I don't like "Mode" as a public API in the configs. Context sounds more Shopify-y.
  // So we have `context: theme` and `context: app` as valid .theme-check.yml configs.
  // I think it's rather obvious what they mean.
  context: Mode;
  settings: ChecksSettings;
  checks: CheckDefinition<SourceCodeType, Schema>[];
  rootUri: string; // e.g. file:///path-to-root
  ignore?: string[];
  onError?: (error: Error) => void;
}

export type NodeOfType<T extends SourceCodeType, NT> = Extract<AST[T], { type: NT }>;
export type LiquidHtmlNodeOfType<T> = NodeOfType<SourceCodeType.LiquidHtml, T>;
export type JSONNodeOfType<T> = NodeOfType<SourceCodeType.LiquidHtml, T>;

// Very intentionally eslint-like. Not reinventing the wheel + makes the
// eslint plugin writing skills transferable.
//
// The conditional type here is used to distribute the union if
// CheckDefinition is used with the enum instead of a specific enum value.
//
// That is, we want (CheckDefinition<JSON> | CheckDefinition<LiquidHTML>)[]
//    we don't want (CheckDefinition<JSON | LiquidHtml>)[]
export type CheckDefinition<
  T = SourceCodeType,
  S extends Schema = Schema,
> = T extends SourceCodeType
  ? {
      /**
       * The meta object holds information about the check.
       * Its name, documentation, severity, etc.
       */
      meta: {
        /** A human readable name for the check */
        name: string;

        /**
         * A code for the check (shortname without spaces).
         *
         * Used in configurations and IDEs.
         *
         * Should be unique.
         */
        code: string;

        /** For backwards compatibility, alternative code names for the check */
        aliases?: string[];

        /** The severity determines the icon and color of diagnostics */
        severity: Severity.ERROR | Severity.WARNING | Severity.INFO;

        /** Which AST type the check targets, must be one of SourceCodeType. */
        type: T;

        /** Human readable short description of the check as well as link to documentation. */
        docs: {
          description: string;
          recommended?: boolean;
          url?: string;
        };

        /**
         * Schema of settings passed to your check.
         *
         * Used to support validations of your setting values, documentation,
         * and IDE support.
         */
        schema: Schema;

        /**
         * An optional array that determines which yaml configs will have this check enabled.
         *
         * When no values are given, this check will be `enabled: true` in the `all.yml` configuration
         *
         * When values are given, this check will be `enabled: false` in the `all.yml` configuration
         * and `enabled: true` within all yaml configurations with a matching filename.
         *
         * targets: ["theme-app-extension"] will set the check to `enabled: true`
         * only within `theme-app-extension.yml`
         */
        targets?: ConfigTarget[];

        deprecated?: boolean;
        replacedBy?: boolean;
      };

      /**
       * A function that returns a Check, the function scope is a good place to
       * initialize state for a run.
       *
       * - One check is created per file
       * - The state is not shared while traversing all files
       * - To report problems, use the context.report method.
       *
       * @example
       *
       * create(context) {
       *   const tags = []
       *
       *   return {
       *     async LiquidTag(node) {
       *       tags.push(node);
       *     },
       *
       *     async onCodePathEnd() {
       *       tags.forEach(tag => {
       *         ...
       *       });
       *     },
       *   }
       * }
       */
      create(context: Context<T, S>): Partial<Check<T>>;
    }
  : never;

/**
 * A Check is an object that defines visitor methods by node type.
 *
 * @example
 * {
 *   async onCodePathStart(file) {
 *     // Happens at the very beginning
 *   },
 *
 *   AssignMarkup: async (node, file) => {
 *     // Happens once per node, while going down the tree
 *   },
 *
 *   "AssignMarkup:exit": async (node, file) => {
 *     // Happens once per node, in reverse order
 *   },
 *
 *   async onCodePathEnd(file) {
 *     // Happens at the very end
 *   }
 * }
 */
export type Check<T> = T extends SourceCodeType
  ? Partial<CheckNodeMethods<T> & CheckExitMethods<T> & CheckLifecycleMethods<T>>
  : never;

export type CheckNodeMethod<T extends SourceCodeType, NT> = (
  node: NodeOfType<T, NT>,
  ancestors: AST[T][],
) => Promise<void>;

type CheckNodeMethods<T extends SourceCodeType> = {
  /** Happens once per node, while going down the tree */
  [NT in NodeTypes[T]]: CheckNodeMethod<T, NT>;
};

type CheckExitMethods<T extends SourceCodeType> = {
  /** Happens once per node, in reverse order */
  [NT in NodeTypes[T] as `${NT}:exit`]: CheckNodeMethod<T, NT>;
};

type CheckLifecycleMethods<T extends SourceCodeType> = {
  /** Happens before traversing a file, file might be unparseable */
  onCodePathStart(file: SourceCode<T>): Promise<void>;

  /** Happens after traversing a file, file is guaranteed to exist */
  onCodePathEnd(file: SourceCode<T> & { ast: AST[T] }): Promise<void>;
};

export type MetafieldCategory =
  | 'article'
  | 'blog'
  | 'brand'
  | 'collection'
  | 'company'
  | 'company_location'
  | 'location'
  | 'market'
  | 'order'
  | 'page'
  | 'product'
  | 'variant'
  | 'shop';

export type MetafieldDefinitionMap = {
  [key in MetafieldCategory]: MetafieldDefinition[];
};

export type MetafieldDefinition = {
  name: string;
  namespace: string;
  description: string;
  type: MetafieldDefinitionType;
};

type MetafieldDefinitionType = {
  category: string;
  name: string;
};

export type Translations = {
  [k in string]: string | Translations;
};

export interface Dependencies {
  fs: AbstractFileSystem;
  themeDocset?: ThemeDocset;
  jsonValidationSet?: JsonValidationSet;
  getMetafieldDefinitions?: (rootUri: UriString) => Promise<MetafieldDefinitionMap>;
}

export type ValidateJSON<T extends SourceCodeType> = (
  file: SourceCode<T>,
  jsonString: string,
) => Promise<{ message: string; startIndex: number; endIndex: number }[]>;

export interface AugmentedDependencies extends Dependencies {
  fileExists: (uri: UriString) => Promise<boolean>;
  fileSize: (uri: UriString) => Promise<number>;
  getDefaultLocale: () => Promise<string>;
  getDefaultSchemaLocale: () => Promise<string>;
  getDefaultTranslations(): Promise<Translations>;
  getDefaultSchemaTranslations(): Promise<Translations>;
}

type StaticContextProperties<T extends SourceCodeType> = T extends SourceCodeType
  ? {
      report(problem: Problem<T>): void;
      toRelativePath(uri: UriString): RelativePath;
      toUri(relativePath: RelativePath): UriString;
      file: SourceCode<T>;
      validateJSON?: ValidateJSON<T>;
    }
  : never;

export type Context<T extends SourceCodeType, S extends Schema = Schema> = T extends SourceCodeType
  ? StaticContextProperties<T> & AugmentedDependencies & { settings: Settings<S> }
  : never;

export type Corrector<T extends SourceCodeType> = T extends SourceCodeType
  ? {
      [SourceCodeType.JSON]: JSONCorrector;
      [SourceCodeType.LiquidHtml]: StringCorrector;
    }[T]
  : never;

/**
 * A Fixer is a function that returns a Fix (a data representation of the change).
 *
 * The Corrector module is helpful for creating Fix objects.
 */
export type Fixer<T extends SourceCodeType> = T extends SourceCodeType
  ? (corrector: Corrector<T>) => void
  : never;
export type LiquidHtmlFixer = Fixer<SourceCodeType.LiquidHtml>;
export type JSONFixer = Fixer<SourceCodeType.JSON>;

/**
 * A data representation of a collection of changes to a document. They all
 * assume that they operate on the initial string independently.
 *
 * It is recursive so that fixes can be grouped together.
 */
export type Fix = FixDescription | Fix[];

/**
 * A data representation of a change to a document.
 *
 * To insert:
 *   - startIndex: x, endIndex: x, insert: insertion
 *
 * To replace:
 *   - startIndex: x, endIndex: y, insert: replacement
 *
 * To delete:
 *   - startIndex: x, endIndex: y, insert: ''
 */
export interface FixDescription {
  /** 0-based index, included */
  startIndex: number;
  /** 0-based index, excluded */
  endIndex: number;
  /** What to replace the contents of the range with. To delete, put entry string. */
  insert: string;
}

/**
 * The FixApplicator is a function that takes a list of FixDescription and
 * applies them on the source to produce a result.
 *
 * - In a CLI context, this might be changeString().then(saveFile)
 * - In the Language Server, this function will collect the TextEdit[]
 *   before sending them as a WorkspaceEdit
 *
 * It is assumed that all FixDescription are all applied to the initial
 * document, and not the one produced by previous FixDescription.
 *
 * It is the FixApplicator's job to throw an error if the FixDescription
 * array contains overlapping ranges.
 *
 * It is the FixApplicator's job to change the location of fixes as indexes
 * drift. See [1] and [2] for inspiration, we're following the same
 * pattern.
 *
 * [1]: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textEditArray
 * [2]: https://codemirror.net/docs/ref/#state.EditorState.update
 */
export interface FixApplicator {
  (source: SourceCode<SourceCodeType>, fixes: Fix): Promise<void>;
}

/**
 * A suggestion is a Fix that we cannot apply automatically. Perhaps
 * because there are multiple options or because the fix is dangerous and
 * requires care.
 *
 * To be used by code editors.
 */
export type Suggestion<T extends SourceCodeType> = T extends SourceCodeType
  ? {
      message: string;
      fix: Fixer<T>;
    }
  : never;

export type LiquidHtmlSuggestion = Suggestion<SourceCodeType.LiquidHtml>;
export type JSONSuggestion = Suggestion<SourceCodeType.JSON>;

export type Problem<T extends SourceCodeType> = T extends SourceCodeType
  ? {
      /** The description of the problem shown to the user */
      message: string;

      /** 0-indexed, included */
      startIndex: number;

      /** 0-indexed, excluded */
      endIndex: number;

      /**
       * The fix attribute is used to provide a "autofix" rule
       * to the offense. It is reserved for safe changes.
       * Unsafe changes should go in `suggest`.
       */
      fix?: Fixer<T>;

      /**
       * Sometimes, it's not appropriate to automatically apply a fix either
       * because it is not safe, or because there are multiple ways to fix it.
       *
       * For instance, we can't know if you'd want to fix a parser blocking
       * script with `defer` or with `async`. The suggest array allows us to
       * provide fixes for either and the user can choose which one they want.
       */
      suggest?: Suggestion<T>[];
    }
  : never;

export type Offense<T extends SourceCodeType = SourceCodeType> = T extends SourceCodeType
  ? {
      type: T;
      check: string;
      message: string;
      uri: string;
      severity: Severity;
      start: Position;
      end: Position;
      fix?: Fixer<T>;
      suggest?: Suggestion<T>[];
    }
  : never;

export interface Position {
  /** 0-indexed */
  index: number;

  /** 1-indexed */
  get line(): number;

  /** 0-indexed */
  get character(): number;
}

/** The severity determines the icon and color of diagnostics */
export enum Severity {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
}

/** The yaml configurations to target checks */
export enum ConfigTarget {
  All = 'all',
  Recommended = 'recommended',
  ThemeAppExtension = 'theme-app-extension',
}
