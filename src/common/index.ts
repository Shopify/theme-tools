interface Theme {
  files: Map<string, SourceCode>;
}

interface BaseSourceCode<T, AST> {
  type: T;
  ast: AST;
  source: string;
  relativePath: string;
  absolutePath: string;
}

enum SourceCodeType {
  LiquidHTML = 'LiquidHTML',
  JSON = 'JSON',
}

interface JsonSourceCode
  extends BaseSourceCode<SourceCodeType.JSON, JSON> {}
interface LiquidHtmlSourceCode
  extends BaseSourceCode<SourceCodeType.LiquidHTML, LiquidHtmlAST> {}

type SourceCode = JsonSourceCode | LiquidHtmlSourceCode;

interface Config {
  settings: {};
  checks: CheckDefinition[];
}

/* tmp == */
enum NodeType {
  AssignMarkup = 'AssignMarkup',
  LiquidTag = 'LiquidTag',
}

type ASTNode = FooNode | BarNode;

interface FooNode {
  type: NodeType.AssignMarkup;
  name: string;
  markup: string[];
}

interface BarNode {
  type: NodeType.LiquidTag;
}
/* ===== */

type NodeOfType<T> = Extract<ASTNode, { type: T }>;

// Very intentionally eslint-like. Not reinventing the wheel + makes the
// eslint plugin writing skills transferable.
interface CheckDefinition {
  meta: {
    severity: Severity.ERROR | Severity.WARNING | Severity.INFO;
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
  create(context: Context): Partial<Check>;
}

type Check = CheckNodeMethods &
  CheckExitMethods &
  CheckLifecycleMethods;

type CheckNodeMethods = {
  [T in NodeType]: (n: NodeOfType<T>) => Promise<void>;
};

type CheckExitMethods = {
  [T in NodeType as `${T}:exit`]: (n: NodeOfType<T>) => Promise<void>;
};

type CheckLifecycleMethods = {
  onCodePathStart(relativePath: string): void;
  onCodePathEnd(relativePath: string): void;
  onEnd(): void;
};

interface Context {
  offenses: Offense[];
  report(): void;
}

interface Offense {
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
  line: number; // 1-indexed

  // 0-indexed
  character: number;
}

enum Severity {
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

function createSafeCheck(check: Partial<Check>): Check {
  return new Proxy(check, handleMissingMethod);
}

/**
 * What if this function was entirely pure?
 * Would make it rather easy to extend...
 */
export async function check(
  theme: Theme,
  config: Config,
): Promise<Offense[]> {
  const context: Context = {};
  const checks = config.checks.map((check) =>
    createSafeCheck(check.create(context)),
  );
  const { files } = theme;

  await Promise.all(
    Array.from(files).map(([, file]) => visit(file, checks)),
  );

  await Promise.all(checks.map((check) => check.onEnd()));

  return context.offenses;
}

async function visit(
  file: SourceCode,
  checks: Check[],
): Promise<void> {
  switch (file.type) {
    case SourceCodeType.LiquidHTML: {
      return visitLiquid(file.ast, checks);
    }
    // case SourceCodeType.JSON: {
    //   return visitJSON(file.ast, checks));
    // }
    // default: {
    //   assertNever(file.type);
    // }
  }
}

async function visitLiquid(
  ast: LiquidHtmlAST,
  checks,
): Promise<void> {}
