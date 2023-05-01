import { LiquidHtmlNode } from '@shopify/prettier-plugin-liquid/dist/parser/stage-2-ast';
import { NodeTypes as LiquidHtmlNodeTypes } from '@shopify/prettier-plugin-liquid/dist/types';

import { ArrayNode, IdentifierNode, LiteralNode, ObjectNode, PropertyNode } from 'json-to-ast';

import { StringCorrector, JSONCorrector } from './fixes';

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

export type NodeOfType<S extends SourceCodeType, T> = Extract<AST[S], { type: T }>;
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
export type CheckDefinition<T> = T extends SourceCodeType
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

        targets: [];
        schema: {}; // TODO
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
      create(context: Context<T>): Partial<Check<T>>;
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
export type Check<S> = S extends SourceCodeType
  ? CheckNodeMethods<S> & CheckExitMethods<S> & CheckLifecycleMethods<S>
  : never;

export type CheckNodeMethod<S extends SourceCodeType, T> = (
  node: NodeOfType<S, T>,
  ancestors: AST[S][],
) => Promise<void>;

type CheckNodeMethods<S extends SourceCodeType> = {
  /** Happens once per node, while going down the tree */
  [T in NodeTypes[S]]: CheckNodeMethod<S, T>;
};

type CheckExitMethods<S extends SourceCodeType> = {
  /** Happens once per node, in reverse order */
  [T in NodeTypes[S] as `${T}:exit`]: CheckNodeMethod<S, T>;
};

type CheckLifecycleMethods<S extends SourceCodeType> = {
  /** Happens before traversing a file */
  onCodePathStart(file: SourceCode<S>): Promise<void>;

  /** Happens after traversing a file */
  onCodePathEnd(file: SourceCode<S>): Promise<void>;
};

export type Translations = {
  [k in string]: string | Translations;
};

export interface Dependencies {
  getDefaultTranslations(): Promise<Translations>;
  getDefaultLocale(): Promise<string>;
  fileExists(absolutePath: string): Promise<boolean>;
}

type StaticContextProperties<S extends SourceCodeType> = S extends SourceCodeType
  ? {
      report(problem: Problem<S>): void;
      relativePath(absolutePath: AbsolutePath): RelativePath;
      absolutePath(relativePath: RelativePath): AbsolutePath;
      file: SourceCode<S>;
    }
  : never;

export type Context<S extends SourceCodeType> = S extends SourceCodeType
  ? StaticContextProperties<S> & Dependencies
  : never;

export type Corrector<S extends SourceCodeType> = S extends SourceCodeType
  ? {
      [SourceCodeType.JSON]: JSONCorrector;
      [SourceCodeType.LiquidHtml]: StringCorrector;
    }[S]
  : never;

/**
 * A Fixer is a function that returns a Fix (a data representation of the change).
 *
 * The Corrector module is helpful for creating Fix objects.
 *
 * import { Corrector } from '@shopify/theme-check-common';
 */
export type Fixer<S extends SourceCodeType> = S extends SourceCodeType
  ? (corrector: Corrector<S>) => void
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
export type Suggestion<S extends SourceCodeType> = S extends SourceCodeType
  ? {
      message: string;
      fix: Fixer<S>;
    }
  : never;

export type LiquidHtmlSuggestion = Suggestion<SourceCodeType.LiquidHtml>;
export type JSONSuggestion = Suggestion<SourceCodeType.JSON>;

export type Problem<S extends SourceCodeType> = S extends SourceCodeType
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
      fix?: Fixer<S>;

      /**
       * Sometimes, it's not appropriate to automatically apply a fix either
       * because it is not safe, or because there are multiple ways to fix it.
       *
       * For instance, we can't know if you'd want to fix a parser blocking
       * script with `defer` or with `async`. The suggest array allows us to
       * provide fixes for either and the user can choose which one they want.
       */
      suggest?: Suggestion<S>[];
    }
  : never;

export type Offense<S extends SourceCodeType = SourceCodeType> = S extends SourceCodeType
  ? {
      type: S;
      check: string;
      message: string;
      absolutePath: string;
      severity: Severity;
      start: Position;
      end: Position;
      fix?: Fixer<S>;
      suggest?: Suggestion<S>[];
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

export enum Severity {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
}

export type WithRequired<T, K extends keyof T> = Required<Pick<T, K>> & Omit<T, K>;
export type WithOptional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;
