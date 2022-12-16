import {
  Check,
  CheckDefinition,
  Config,
  Context,
  JSONCheck,
  JSONSourceCode,
  LiquidCheck,
  LiquidSourceCode,
  Offense,
  Position,
  Problem,
  SourceCode,
  SourceCodeType,
  Theme,
} from './types';
import { visitLiquid, visitJSON } from './visitors';
import lineColumn from 'line-column';

export * from './types';
export * from './checks';

/**
 * What if this function was entirely pure?
 * Would make it rather easy to extend...
 */
export async function check(theme: Theme, config: Config): Promise<Offense[]> {
  const pipelines: Promise<void>[] = [];
  const offenses: Offense[] = [];
  const allChecks: (LiquidCheck | JSONCheck)[] = [];

  for (const type of Object.values(SourceCodeType)) {
    switch (type) {
      case SourceCodeType.JSON: {
        const files = filesOfType(type, theme);
        const checks = checksOfType(type, config.checks, offenses);
        allChecks.push(...checks);
        pipelines.push(checkJSONFiles(checks, files));
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

const resolve = () => Promise.resolve(undefined);
const handleMissingMethod = {
  get(target: any, prop: string) {
    if (!(prop in target)) return resolve;
    return target[prop];
  },
};

function createSafeCheck<S extends SourceCodeType>(check: Partial<Check<S>>): Check<S> {
  return new Proxy(check, handleMissingMethod);
}

function getPosition(source: string, index: number): Position {
  const lineCol = lineColumn(source, { origin: 0 }).fromIndex(Math.min(index, source.length - 1));

  return {
    index,
    line: lineCol ? lineCol.line : -1,
    character: lineCol ? lineCol.col : -1,
  };
}

function createContext<S extends SourceCodeType>(
  check: CheckDefinition<S>,
  offenses: Offense[],
): Context<S> {
  // we build ASTs here in the one and done context
  return {
    report(file: SourceCode<S>, problem: Problem): void {
      offenses.push({
        check: check.meta.code,
        message: problem.message,
        relativePath: file.relativePath,
        severity: check.meta.severity,
        start: getPosition(file.source, problem.startIndex),
        end: getPosition(file.source, problem.endIndex),
      });
    },
  } as Context<S>;
}

function checksOfType<S extends SourceCodeType>(
  type: S,
  checks: CheckDefinition<SourceCodeType>[],
  offenses: Offense[],
): Check<S>[] {
  return checks
    .filter((def): def is CheckDefinition<S> => def.meta.type === type)
    .map((check) => {
      const context = createContext(check, offenses);
      return check.create(context as any);
    })
    .map(createSafeCheck) as Check<S>[];
}

function filesOfType<S extends SourceCodeType>(type: S, theme: Theme): SourceCode<S>[] {
  return Array.from(theme.files.values()).filter(
    (file): file is SourceCode<S> => file.type === type,
  );
}

async function checkJSONFiles(checks: JSONCheck[], files: JSONSourceCode[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      await Promise.all(
        checks.map(async (check) => {
          await check.onCodePathStart(file);
          await visitJSON(file.ast, check, file);
          await check.onCodePathEnd(file);
        }),
      );
    }),
  );
}

async function checkLiquidFiles(checks: LiquidCheck[], files: LiquidSourceCode[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      // TODO obtain check ignore ranges before doing the following...
      await Promise.all(
        checks.map(async (check) => {
          await check.onCodePathStart(file);
          await visitLiquid(file.ast, check, file);
          await check.onCodePathEnd(file);
        }),
      );
    }),
  );
}
