import { LiquidHtmlNode } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import { NodeTypes as LiquidHtmlNodeTypes } from '@shopify/prettier-plugin-liquid/dist/types';

import { ArrayNode, IdentifierNode, LiteralNode, ObjectNode, PropertyNode } from 'json-to-ast';

export type Theme = SourceCode<SourceCodeType>[];

export type SourceCode<S> = S extends SourceCodeType
  ? {
      absolutePath: string; // /path/to/snippet/foo.liquid
      version?: number;
      source: string;
      type: S; // Liquid | LiquidHtml | JSON
      ast: AST[S]; // LiquidAST | LiquidHtmlAST | JSON object
    }
  : never;

export enum SourceCodeType {
  JSON = 'JSON',
  LiquidHtml = 'LiquidHtml',
}

export type LiquidSourceCode = SourceCode<SourceCodeType.LiquidHtml>;
export type LiquidCheckDefinition = CheckDefinition<SourceCodeType.LiquidHtml>;
export type LiquidCheck = Check<SourceCodeType.LiquidHtml>;

export { LiquidHtmlNodeTypes };
export { LiquidHtmlNode };

export type JSONSourceCode = SourceCode<SourceCodeType.JSON>;
export type JSONCheckDefinition = CheckDefinition<SourceCodeType.JSON>;
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

export type AbsolutePath = string;
export type RelativePath = string;

export interface Config {
  settings: {};
  checks: CheckDefinition<SourceCodeType>[];
  root: AbsolutePath;
}

type NodeOfType<S extends SourceCodeType, T> = Extract<AST[S], { type: T }>;

// Very intentionally eslint-like. Not reinventing the wheel + makes the
// eslint plugin writing skills transferable.
//
// The conditional type here is used to distribute the union if
// CheckDefinition is used with the enum instead of a specific enum value.
//
// That is, we want (CheckDefinition<JSON> | CheckDefinition<LiquidHTML>)[]
//    we don't want (CheckDefinition<JSON | LiquidHtml>)[]
export type CheckDefinition<T> = T extends SourceCodeType
  ? {
      /**
       * The meta object holds information about the check.
       * Its name, documentation, severity, etc.
       */
      meta: {
        /**
         * A human readable name for the check
         */
        name: string;

        /**
         * A code for the check (shortname without spaces).
         *
         * Used in configurations and IDEs.
         *
         * Should be unique.
         */
        code: string;

        /**
         * The severity determines the icon and color of diagnostics
         */
        severity: Severity.ERROR | Severity.WARNING | Severity.INFO;

        /**
         * Which AST type the check targets, must be one of SourceCodeType.
         */
        type: T;

        /**
         * Human readable short description of the check as well as link to documentation.
         */
        docs: {
          description: string;
          recommended?: boolean;
          url?: string;
        };

        targets: [];
        fixable?: boolean;
        hasSuggestions?: boolean;
        schema: {}; // TODO
        deprecated?: boolean;
        replacedBy?: boolean;
      };

      /**
       * A function that returns a Check, the function scope is a good place to
       * initialize state for a run.
       *
       * - One check is created per run
       * - The state is shared while traversing all files
       * - To report problems, use the context.report method.
       *
       * @example
       *
       * create(context) {
       *   const variables = new Map();
       *
       *   return {
       *     async onCodePathStart(file) {
       *       variables.set(file, new Set());
       *     },
       *
       *     async LiquidAssignMarkup(node, file) {
       *       if (node.name.includes(/[A-Z]/)) {
       *         context.report(file, {
       *           message: 'prefer snake_case',
       *           startIndex: node.position.start,
       *           endIndex: node.position.end,
       *         })
       *       }
       *     },
       *   }
       * }
       */
      create(context: Context<T>): Partial<Check<T>>;
    }
  : never;

/**
 * A Check is an object that defines visitor methods by node type.
 *
 * @example
 * {
 *   async onCodePathStart(file) {
 *     // Happens once per file
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
 *     // Happens once per file
 *   }
 * }
 */
export type Check<S> = S extends SourceCodeType
  ? CheckNodeMethods<S> & CheckExitMethods<S> & CheckLifecycleMethods<S>
  : never;

export type CheckNodeMethod<S extends SourceCodeType, T> = (
  node: NodeOfType<S, T>,
  file: SourceCode<S>,
  ancestors: AST[S][],
) => Promise<void>;

type CheckNodeMethods<S extends SourceCodeType> = {
  /**
   * Happens once per node, while going down the tree
   */
  [T in NodeTypes[S]]: CheckNodeMethod<S, T>;
};

type CheckExitMethods<S extends SourceCodeType> = {
  /**
   * Happens once per node, in reverse order
   */
  [T in NodeTypes[S] as `${T}:exit`]: CheckNodeMethod<S, T>;
};

type CheckLifecycleMethods<S extends SourceCodeType> = {
  /**
   * Happens before traversing a file
   */
  onCodePathStart(file: SourceCode<S>): Promise<void>;
  /**
   * Happens after traversing a file
   */
  onCodePathEnd(file: SourceCode<S>): Promise<void>;
};

export interface Dependencies {
  getDefaultTranslations(): Promise<object>;
  fileExists(absolutePath: string): Promise<boolean>;
}

type StaticContextMethods<S> = {
  report(file: SourceCode<S>, problem: Problem): void;
  relativePath(absolutePath: AbsolutePath): RelativePath;
  absolutePath(relativePath: RelativePath): AbsolutePath;
};

export type Context<S extends SourceCodeType> = S extends SourceCodeType
  ? StaticContextMethods<S> & Dependencies
  : never;

export interface Problem {
  message: string;
  startIndex: number; // 0-indexed
  endIndex: number; // 0-indexed
  fix?: undefined; // TODO
  suggest?: undefined; // TODO
}

export interface Offense {
  check: string;
  message: string;
  absolutePath: string;
  severity: Severity;
  start: Position;
  end: Position;
}

export interface Position {
  // 0-indexed
  index: number;

  // 1-indexed
  get line(): number; // 1-indexed

  // 0-indexed
  get character(): number;
}

export enum Severity {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
}
