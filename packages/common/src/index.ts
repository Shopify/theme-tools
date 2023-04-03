import {
  Check,
  CheckDefinition,
  Config,
  Context,
  Dependencies,
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
import { createDisabledChecksModule } from './disabled-checks';
import * as path from './path';

export * from './types';
export * from './checks';
export * from './to-source-code';

export async function check(
  theme: Theme,
  config: Config,
  dependencies: Dependencies,
): Promise<Offense[]> {
  const pipelines: Promise<void>[] = [];
  const offenses: Offense[] = [];
  const { DisabledChecks, isDisabled } = createDisabledChecksModule();

  const allChecks: (LiquidCheck | JSONCheck)[] = [];

  for (const type of Object.values(SourceCodeType)) {
    switch (type) {
      case SourceCodeType.JSON: {
        const files = filesOfType(type, theme);
        const checks = checksOfType(type, config, offenses, dependencies);
        allChecks.push(...checks);
        pipelines.push(checkJSONFiles(checks, files));
        break;
      }
      case SourceCodeType.LiquidHtml: {
        const files = filesOfType(type, theme);
        const checks = checksOfType(type, config, offenses, dependencies);
        checks.push(createSafeCheck(DisabledChecks));
        allChecks.push(...checks);
        pipelines.push(checkLiquidFiles(checks, files));
        break;
      }
    }
  }

  await Promise.all(pipelines);

  return offenses.filter((offense) => !isDisabled(offense));
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
  config: Config,
  dependencies: Dependencies,
): Context<S> {
  return {
    ...dependencies,
    absolutePath: (relativePath) => path.join(config.root, relativePath),
    relativePath: (absolutePath) => path.relative(absolutePath, config.root),
    report(file: SourceCode<S>, problem: Problem): void {
      offenses.push({
        check: check.meta.code,
        message: problem.message,
        absolutePath: file.absolutePath,
        severity: check.meta.severity,
        start: getPosition(file.source, problem.startIndex),
        end: getPosition(file.source, problem.endIndex),
      });
    },
  } as Context<S>;
}

function checksOfType<S extends SourceCodeType>(
  type: S,
  config: Config,
  offenses: Offense[],
  dependencies: Dependencies,
): Check<S>[] {
  return config.checks
    .filter((def): def is CheckDefinition<S> => def.meta.type === type)
    .map((check) => {
      const context = createContext(check, offenses, config, dependencies);
      return check.create(context as any);
    })
    .map(createSafeCheck) as Check<S>[];
}

function filesOfType<S extends SourceCodeType>(type: S, theme: Theme): SourceCode<S>[] {
  return theme.filter((file): file is SourceCode<S> => file.type === type);
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
