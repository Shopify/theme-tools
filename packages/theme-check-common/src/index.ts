import { AugmentedThemeDocset } from './AugmentedThemeDocset';
import { JSONValidator } from './JSONValidator';
import {
  makeGetDefaultLocale,
  makeGetDefaultSchemaLocale,
  makeGetDefaultSchemaTranslations,
  makeGetDefaultTranslations,
  makeFileExists,
  makeFileSize,
} from './context-utils';
import { createDisabledChecksModule } from './disabled-checks';
import { isIgnored } from './ignore';
import * as path from './path';
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
  ValidateJSON,
} from './types';
import { getPosition } from './utils';
import { visitJSON, visitLiquid } from './visitors';

export * from './AbstractFileSystem';
export * from './AugmentedThemeDocset';
export * from './checks';
export * from './context-utils';
export * from './fixes';
export * from './ignore';
export * from './json';
export * as path from './path';
export * from './to-source-code';
export * from './types';
export * from './utils/error';
export * from './utils/indexBy';
export * from './utils/memo';
export * from './utils/types';

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
  let validateJSON: ValidateJSON<SourceCodeType> | undefined;

  // We're memozing those deps here because they shouldn't change within a run.
  if (dependencies.themeDocset && !dependencies.themeDocset.isAugmented) {
    dependencies.themeDocset = new AugmentedThemeDocset(dependencies.themeDocset);
  }

  if (dependencies.jsonValidationSet) {
    const jsonValidator = new JSONValidator(
      await dependencies.jsonValidationSet.schemas(config.context),
    );
    validateJSON = jsonValidator.validate.bind(jsonValidator);
  }

  for (const type of Object.values(SourceCodeType)) {
    switch (type) {
      case SourceCodeType.JSON: {
        const files = filesOfType(type, sourceCodes);
        const checkDefs = checksOfType(type, config.checks);
        for (const file of files) {
          for (const checkDef of checkDefs) {
            if (isIgnored(file.uri, config, checkDef)) continue;
            const check = createCheck(checkDef, file, config, offenses, dependencies, validateJSON);
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
            if (isIgnored(file.uri, config, checkDef)) continue;
            const check = createCheck(checkDef, file, config, offenses, dependencies, validateJSON);
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
  validateJSON?: ValidateJSON<SourceCodeType>,
): Context<T, S> {
  const checkSettings = config.settings[check.meta.code];
  return {
    ...dependencies,
    fileExists: makeFileExists(dependencies.fs),
    fileSize: makeFileSize(dependencies.fs),
    getDefaultLocale: makeGetDefaultLocale(dependencies.fs, config.rootUri),
    getDefaultTranslations:
      dependencies.getDefaultTranslations ??
      makeGetDefaultTranslations(dependencies.fs, config.rootUri),
    getDefaultSchemaLocale: makeGetDefaultSchemaLocale(dependencies.fs, config.rootUri),
    getDefaultSchemaTranslations:
      dependencies.getDefaultSchemaTranslations ??
      makeGetDefaultSchemaTranslations(dependencies.fs, config.rootUri),
    validateJSON,
    settings: createSettings(checkSettings, check.meta.schema),
    toUri: (relativePath) => path.join(config.rootUri, relativePath),
    toRelativePath: (uri) => path.relative(uri, config.rootUri),
    report(problem: Problem<T>): void {
      offenses.push({
        type: check.meta.type,
        check: check.meta.code,
        message: problem.message,
        uri: file.uri,
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
  validateJSON?: ValidateJSON<SourceCodeType>,
): Check<S> {
  const context = createContext(check, file, offenses, config, dependencies, validateJSON);
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
