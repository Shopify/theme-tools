import {
  Check,
  CheckDefinition,
  CheckSettings,
  Config,
  Context,
  Dependencies,
  JSONCheck,
  JSONNode,
  JSONSourceCode,
  LiquidCheck,
  LiquidHtmlNode,
  LiquidSourceCode,
  Offense,
  Problem,
  Schema,
  Settings,
  SourceCode,
  SourceCodeType,
  Theme,
} from './types';
import { visitLiquid, visitJSON } from './visitors';
import { createDisabledChecksModule } from './disabled-checks';
import * as path from './path';
import { getPosition } from './utils';
import { isIgnored } from './ignore';
import { AugmentedThemeDocset } from './AugmentedThemeDocset';
import { AugmentedJsonValidationSet } from './AugmentedJsonValidationSet';

export * from './AugmentedThemeDocset';
export * from './AugmentedJsonValidationSet';
export * from './fixes';
export * from './types';
export * from './checks';
export * from './to-source-code';
export * from './ignore';
export * from './utils/types';
export * from './utils/memo';

const defaultErrorHandler = (_error: Error): void => {
  // Silently ignores errors by default.
};

export async function check(
  sourceCodes: Theme,
  config: Config,
  dependencies: Dependencies,
): Promise<Offense[]> {
  const pipelines: Promise<void>[] = [];
  const offenses: Offense[] = [];
  const { DisabledChecksVisitor, isDisabled } = createDisabledChecksModule();

  // We're memozing those deps here because they shouldn't change within a run.
  if (dependencies.themeDocset && !dependencies.themeDocset.isAugmented) {
    dependencies.themeDocset = new AugmentedThemeDocset(dependencies.themeDocset);
  }

  if (dependencies.jsonValidationSet && !dependencies.jsonValidationSet.isAugmented) {
    dependencies.jsonValidationSet = new AugmentedJsonValidationSet(dependencies.jsonValidationSet);
  }

  for (const type of Object.values(SourceCodeType)) {
    switch (type) {
      case SourceCodeType.JSON: {
        const files = filesOfType(type, sourceCodes);
        const checkDefs = checksOfType(type, config.checks);
        for (const file of files) {
          for (const checkDef of checkDefs) {
            if (isIgnored(file.absolutePath, config, checkDef)) continue;
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
            if (isIgnored(file.absolutePath, config, checkDef)) continue;
            const check = createCheck(checkDef, file, config, offenses, dependencies);
            pipelines.push(checkLiquidFile(check, file));
          }
        }
        break;
      }
    }
  }

  const onRejected = config.onError || defaultErrorHandler;
  await Promise.all(pipelines.map((pipeline) => pipeline.catch(onRejected)));

  return offenses.filter((offense) => !isDisabled(offense));
}

function createContext<T extends SourceCodeType, S extends Schema>(
  check: CheckDefinition<T, S>,
  file: SourceCode<T>,
  offenses: Offense[],
  config: Config,
  dependencies: Dependencies,
): Context<T, S> {
  const checkSettings = config.settings[check.meta.code];
  return {
    ...dependencies,
    settings: createSettings(checkSettings, check.meta.schema),
    absolutePath: (relativePath) => path.join(config.root, relativePath),
    relativePath: (absolutePath) => path.relative(absolutePath, config.root),
    report(problem: Problem<T>): void {
      offenses.push({
        type: check.meta.type,
        check: check.meta.code,
        message: problem.message,
        absolutePath: file.absolutePath,
        severity: checkSettings?.severity ?? check.meta.severity,
        start: getPosition(file.source, problem.startIndex),
        end: getPosition(file.source, problem.endIndex),
        fix: problem.fix,
        suggest: problem.suggest,
      } as Offense<T>);
    },
    file,
  } as Context<T, S>;
}

function createSettings<S extends Schema>(
  checkSettings: CheckSettings | undefined,
  schema: S,
): Settings<S> {
  const settings: Partial<Settings<S>> = {};

  for (const [key, schemaProp] of Object.entries(schema)) {
    settings[key as keyof S] = checkSettings?.[key] ?? schemaProp.defaultValue();
  }

  return settings as Settings<S>;
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
  return check.create(context as any) as Check<S>;
}

function filesOfType<S extends SourceCodeType>(type: S, sourceCodes: Theme): SourceCode<S>[] {
  return sourceCodes.filter((file): file is SourceCode<S> => file.type === type);
}

async function checkJSONFile(check: JSONCheck, file: JSONSourceCode): Promise<void> {
  if (check.onCodePathStart) await check.onCodePathStart(file);
  if (file.ast instanceof Error) return;
  if (Object.keys(check).length > 0) await visitJSON(file.ast, check);
  if (check.onCodePathEnd) await check.onCodePathEnd(file as typeof file & { ast: JSONNode });
}

async function checkLiquidFile(check: LiquidCheck, file: LiquidSourceCode): Promise<void> {
  if (check.onCodePathStart) await check.onCodePathStart(file);
  if (file.ast instanceof Error) return;
  if (Object.keys(check).length > 0) await visitLiquid(file.ast, check);
  if (check.onCodePathEnd) await check.onCodePathEnd(file as typeof file & { ast: LiquidHtmlNode });
}
