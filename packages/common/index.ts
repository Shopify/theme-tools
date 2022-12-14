import {
  NodeTypes,
  LiquidHtmlNode,
} from '@shopify/prettier-plugin-liquid/dist/types';

// Immutable
interface Theme {
  files: Map<string, SourceCode<SourceCodeType>>;
}

interface SourceCode<T extends SourceCodeType> {
  relativePath: string; // snippet/foo.liquid
  absolutePath: string; // snippet/foo.liquid
  version?: number;
  source?: string;
  type: T; // Liquid | LiquidHtml | JSON
  ast: AST[T]; // LiquidAST | LiquidHtmlAST | JSON object
}

export enum SourceCodeType {
  JSON = 'JSON',
  LiquidHtml = 'LiquidHtml',
}

export type LiquidSourceCode = SourceCode<SourceCodeType.LiquidHtml>;
export type LiquidCheckDefinition = CheckDefinition<SourceCodeType.LiquidHtml>
export type LiquidCheck = Check<LiquidHtmlNode, LiquidSourceCode>;

export type JSONSourceCode = SourceCode<SourceCodeType.JSON>;
export type JSONCheckDefinition = CheckDefinition<SourceCodeType.JSON>
export type JSONCheck = Check<JSON, JSONSourceCode>;

// AST[SourceCodeType.LiquidHtml] maps to LiquidHtmlNode
type AST = {
  [T in SourceCodeType]: {
    [SourceCodeType.JSON]: JSON;
    [SourceCodeType.LiquidHtml]: LiquidHtmlNode;
  }[T];
};

export interface Config {
  settings: {};
  checks: CheckDefinition<SourceCodeType>[];
}

type NodeOfType<AST, T> = Extract<AST, { type: T }>;

// Very intentionally eslint-like. Not reinventing the wheel + makes the
// eslint plugin writing skills transferable.
export interface CheckDefinition<T extends SourceCodeType> {
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
  create(context: Context<T>): Partial<Check<AST[T], SourceCode<T>>>;
}

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
 *
 *   async onEnd() {
 *     // Happens once per run, after all files were traversed
 *   }
 * }
 */
type Check<AST, SourceCode> = CheckNodeMethods<AST, SourceCode> &
  CheckExitMethods<AST, SourceCode> &
  CheckLifecycleMethods<SourceCode>;

type CheckNodeMethod<AST, T, SourceCode> = (
  node: NodeOfType<AST, T>,
  file: SourceCode,
) => Promise<void>;

type CheckNodeMethods<AST, SourceCode> = {
  /**
   * Happens once per node, while going down the tree
   */
  [T in NodeTypes]: CheckNodeMethod<AST, T, SourceCode>;
};

type CheckExitMethods<AST, SourceCode> = {
  /**
   * Happens once per node, in reverse order
   */
  [T in NodeTypes as `${T}:exit`]: CheckNodeMethod<
    AST,
    T,
    SourceCode
  >;
};

type CheckLifecycleMethods<SourceCode> = {
  /**
   * Happens before traversing a file
   */
  onCodePathStart(file: SourceCode): Promise<void>;
  /**
   * Happens after traversing a file
   */
  onCodePathEnd(file: SourceCode): Promise<void>;
  /**
   * Happens after traversing all files
   */
  onEnd(): Promise<void>;
};

export interface Context<T extends SourceCodeType> {
  report(file: SourceCode<T>, problem: Problem): void;
}

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
  relativePath: string;
  severity: Severity;
  start: Position;
  end: Position;
}

interface Position {
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

const handleMissingMethod = {
  get(target: any, prop: string) {
    if (!(prop in target)) return Promise.resolve;
    return target[prop];
  },
};

function createSafeCheck<AST, SourceCode>(
  check: Partial<Check<AST, SourceCode>>,
): Check<AST, SourceCode> {
  return new Proxy(check, handleMissingMethod);
}

function getPosition(
  _source: string | undefined,
  index: number,
): Position {
  return {
    index,
    get line() {
      return 0; // TODO (should be lazy)
    },
    get character() {
      return 0; // TODO
    },
  };
}

function createContext<T extends SourceCodeType>(
  check: CheckDefinition<T>,
  offenses: Offense[],
): Context<T> {
  // we build ASTs here in the one and done context
  return {
    report(file: SourceCode<T>, problem: Problem): void {
      offenses.push({
        check: check.meta.code,
        message: problem.message,
        relativePath: file.relativePath,
        severity: check.meta.severity,
        start: getPosition(file.source, problem.startIndex),
        end: getPosition(file.source, problem.endIndex),
      });
    },
  };
}

function checksOfType<T extends SourceCodeType>(
  type: T,
  checks: CheckDefinition<SourceCodeType>[],
  offenses: Offense[],
): Check<AST[T], SourceCode<T>>[] {
  const filteredChecks = checks.filter(
    (def) => def.meta.type === type,
  ) as unknown as CheckDefinition<T>[];

  return filteredChecks
    .map((check) => {
      const context = createContext(check, offenses);
      return check.create(context);
    })
    .map(createSafeCheck);
}

function filesOfType<T extends SourceCodeType>(
  type: T,
  theme: Theme,
): SourceCode<T>[] {
  return [...theme.files.values()].filter(
    (file) => file.type === type,
  ) as unknown as SourceCode<T>[];
}

/**
 * What if this function was entirely pure?
 * Would make it rather easy to extend...
 */
export async function check(
  theme: Theme,
  config: Config,
): Promise<Offense[]> {
  // That's a lot of promises :)
  const pipelines: Promise<any>[] = [];
  const offenses: Offense[] = [];
  const allChecks: (LiquidCheck | JSONCheck)[] = [];

  for (const type of Object.values(SourceCodeType)) {
    switch (type) {
      case SourceCodeType.JSON: {
        // visitJSON
        break;
      }
      case SourceCodeType.LiquidHtml: {
        const files = filesOfType(type, theme);
        const checks = checksOfType(type, config.checks, offenses);
        allChecks.push(...checks);
        pipelines.push(checkLiquidFiles(checks, files));
        break;
      }
    }
  }

  await Promise.all(pipelines);
  await Promise.all(allChecks.map((check) => check.onEnd()));

  return offenses;
}

async function checkLiquidFiles(
  checks: LiquidCheck[],
  files: LiquidSourceCode[],
): Promise<void> {
  await Promise.all([
    files.map(async (file) => {
      await Promise.all([
        checks.map(async (check) => {
          await check.onCodePathStart(file);
          await visitLiquid(file.ast, check, file);
          await check.onCodePathEnd(file);
        }),
      ]);
    }),
  ]);
}

function isLiquidHtmlNode(thing: unknown): thing is LiquidHtmlNode {
  return (
    !!thing &&
    typeof thing === 'object' &&
    'type' in thing &&
    !!NodeTypes[thing.type as NodeTypes]
  );
}

function onCheckNodeEnterMethod(
  check: LiquidCheck,
  node: LiquidHtmlNode,
  file: LiquidSourceCode,
): Promise<void> {
  const method = check[node.type] as CheckNodeMethod<
    LiquidHtmlNode,
    NodeTypes,
    LiquidSourceCode
  >;
  return method(node, file);
}

function onCheckNodeExitMethod(
  check: LiquidCheck,
  node: LiquidHtmlNode,
  file: LiquidSourceCode,
): Promise<void> {
  const method = check[`${node.type}:exit`] as CheckNodeMethod<
    LiquidHtmlNode,
    NodeTypes,
    LiquidSourceCode
  >;
  return method(node, file);
}

// It goes:
// check[node.type](node)
// for each child (visit child)
// for each attribute (visit attribute)
// ...
// check[`${node.type}:exit`](node)

async function visitLiquid(
  node: LiquidHtmlNode,
  check: LiquidCheck,
  file: LiquidSourceCode,
): Promise<void> {
  await onCheckNodeEnterMethod(check, node, file);

  for (const key of Object.keys(node)) {
    if (
      [
        'parentNode',
        'prev',
        'next',
        'firstChild',
        'lastChild',
      ].includes(key)
    ) {
      continue;
    }
    const value = (node as any)[key];
    if (Array.isArray(value)) {
      await Promise.all(
        value
          .filter(isLiquidHtmlNode)
          .map((node: LiquidHtmlNode) =>
            visitLiquid(node, check, file),
          ),
      );
    } else if (isLiquidHtmlNode(value)) {
      await visitLiquid(value, check, file);
    }
  }

  await onCheckNodeExitMethod(check, node, file);
}
