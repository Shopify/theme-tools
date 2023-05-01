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
import { createSafeCheck } from './create-safe-check';
import * as path from './path';

export * from './fixes';
export * from './types';
export * from './checks';
export * from './to-source-code';

export async function check(
  sourceCodes: Theme,
  config: Config,
  dependencies: Dependencies,
): Promise<Offense[]> {
  const pipelines: Promise<void>[] = [];
  const offenses: Offense[] = [];
  const { DisabledChecksVisitor, isDisabled } = createDisabledChecksModule();

  for (const type of Object.values(SourceCodeType)) {
    switch (type) {
      case SourceCodeType.JSON: {
        const files = filesOfType(type, sourceCodes);
        const checkDefs = checksOfType(type, config.checks);
        for (const file of files) {
          for (const checkDef of checkDefs) {
            const check = createCheck(checkDef, file, config, offenses, dependencies);
            pipelines.push(checkJSONFile(check, file));
          }
        }
        break;
      }
      case SourceCodeType.LiquidHtml: {
        const files = filesOfType(type, sourceCodes);
        const checkDefs = [DisabledChecksVisitor, ...checksOfType(type, config.checks)];
        for (const file of files) {
          for (const checkDef of checkDefs) {
            const check = createCheck(checkDef, file, config, offenses, dependencies);
            pipelines.push(checkLiquidFile(check, file));
          }
        }
        break;
      }
    }
  }

  await Promise.all(pipelines);

  return offenses.filter((offense) => !isDisabled(offense));
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
  file: SourceCode<S>,
  offenses: Offense[],
  config: Config,
  dependencies: Dependencies,
): Context<S> {
  return {
    ...dependencies,
    absolutePath: (relativePath) => path.join(config.root, relativePath),
    relativePath: (absolutePath) => path.relative(absolutePath, config.root),
    report(problem: Problem<S>): void {
      offenses.push({
        type: check.meta.type,
        check: check.meta.code,
        message: problem.message,
        absolutePath: file.absolutePath,
        severity: check.meta.severity,
        start: getPosition(file.source, problem.startIndex),
        end: getPosition(file.source, problem.endIndex),
        fix: problem.fix,
        suggest: problem.suggest,
      } as Offense<S>);
    },
    file,
  } as Context<S>;
}

function checksOfType<S extends SourceCodeType>(
  type: S,
  checks: CheckDefinition<SourceCodeType>[],
): CheckDefinition<S>[] {
  return checks.filter((def): def is CheckDefinition<S> => def.meta.type === type);
}

function createCheck<S extends SourceCodeType>(
  check: CheckDefinition<S>,
  file: SourceCode<S>,
  config: Config,
  offenses: Offense[],
  dependencies: Dependencies,
): Check<S> {
  const context = createContext(check, file, offenses, config, dependencies);
  return createSafeCheck(check.create(context as any)) as Check<S>;
}

function filesOfType<S extends SourceCodeType>(type: S, sourceCodes: Theme): SourceCode<S>[] {
  return sourceCodes.filter((file): file is SourceCode<S> => file.type === type);
}

async function checkJSONFile(check: JSONCheck, file: JSONSourceCode): Promise<void> {
  await check.onCodePathStart(file);
  await visitJSON(file.ast, check);
  await check.onCodePathEnd(file);
}

async function checkLiquidFile(check: LiquidCheck, file: LiquidSourceCode): Promise<void> {
  await check.onCodePathStart(file);
  await visitLiquid(file.ast, check);
  await check.onCodePathEnd(file);
}
