"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlockName = exports.path = void 0;
exports.check = check;
const AugmentedThemeDocset_1 = require("./AugmentedThemeDocset");
const JSONValidator_1 = require("./JSONValidator");
const context_utils_1 = require("./context-utils");
const disabled_checks_1 = require("./disabled-checks");
const ignore_1 = require("./ignore");
const path = __importStar(require("./path"));
const types_1 = require("./types");
const utils_1 = require("./utils");
const visitors_1 = require("./visitors");
__exportStar(require("./AbstractFileSystem"), exports);
__exportStar(require("./AugmentedThemeDocset"), exports);
__exportStar(require("./checks"), exports);
__exportStar(require("./context-utils"), exports);
__exportStar(require("./find-root"), exports);
__exportStar(require("./fixes"), exports);
__exportStar(require("./ignore"), exports);
__exportStar(require("./json"), exports);
__exportStar(require("./JSONValidator"), exports);
exports.path = __importStar(require("./path"));
__exportStar(require("./to-schema"), exports);
__exportStar(require("./to-source-code"), exports);
__exportStar(require("./types"), exports);
__exportStar(require("./utils/error"), exports);
__exportStar(require("./utils/indexBy"), exports);
__exportStar(require("./utils/memo"), exports);
__exportStar(require("./utils/types"), exports);
__exportStar(require("./utils/object"), exports);
__exportStar(require("./visitor"), exports);
__exportStar(require("./liquid-doc/liquidDoc"), exports);
var arguments_1 = require("./liquid-doc/arguments");
Object.defineProperty(exports, "getBlockName", { enumerable: true, get: function () { return arguments_1.getBlockName; } });
__exportStar(require("./liquid-doc/utils"), exports);
const defaultErrorHandler = (_error) => {
    // Silently ignores errors by default.
};
async function check(theme, config, injectedDependencies) {
    var _a;
    const pipelines = [];
    const offenses = [];
    const { fs } = injectedDependencies;
    const { rootUri } = config;
    const dependencies = {
        ...injectedDependencies,
        mode: config.context,
        fileExists: (0, context_utils_1.makeFileExists)(fs),
        fileSize: (0, context_utils_1.makeFileSize)(fs),
        getDefaultLocale: (0, context_utils_1.makeGetDefaultLocale)(fs, rootUri),
        getDefaultTranslations: (0, context_utils_1.makeGetDefaultTranslations)(fs, theme, rootUri),
        getDefaultSchemaLocale: (0, context_utils_1.makeGetDefaultSchemaLocale)(fs, rootUri),
        getDefaultSchemaTranslations: (0, context_utils_1.makeGetDefaultSchemaTranslations)(fs, theme, rootUri),
        getMetafieldDefinitions: (_a = injectedDependencies.getMetafieldDefinitions) !== null && _a !== void 0 ? _a : (0, context_utils_1.makeGetMetafieldDefinitions)(fs),
    };
    const { DisabledChecksVisitor, isDisabled } = (0, disabled_checks_1.createDisabledChecksModule)();
    const jsonValidator = await JSONValidator_1.JSONValidator.create(dependencies.jsonValidationSet, config);
    const validateJSON = jsonValidator === null || jsonValidator === void 0 ? void 0 : jsonValidator.validate;
    // We're memozing those deps here because they shouldn't change within a run.
    if (dependencies.themeDocset && !dependencies.themeDocset.isAugmented) {
        dependencies.themeDocset = new AugmentedThemeDocset_1.AugmentedThemeDocset(dependencies.themeDocset);
    }
    for (const type of Object.values(types_1.SourceCodeType)) {
        switch (type) {
            case types_1.SourceCodeType.JSON: {
                const files = filesOfType(type, theme);
                const checkDefs = checksOfType(type, config.checks);
                for (const file of files) {
                    for (const checkDef of checkDefs) {
                        if ((0, ignore_1.isIgnored)(file.uri, config, checkDef))
                            continue;
                        const check = createCheck(checkDef, file, config, offenses, dependencies, validateJSON);
                        pipelines.push(checkJSONFile(check, file));
                    }
                }
                break;
            }
            case types_1.SourceCodeType.LiquidHtml: {
                const files = filesOfType(type, theme);
                const checkDefs = [DisabledChecksVisitor, ...checksOfType(type, config.checks)];
                for (const file of files) {
                    for (const checkDef of checkDefs) {
                        if ((0, ignore_1.isIgnored)(file.uri, config, checkDef))
                            continue;
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
function createContext(check, file, offenses, config, dependencies, validateJSON) {
    const checkSettings = config.settings[check.meta.code];
    return {
        ...dependencies,
        validateJSON,
        settings: createSettings(checkSettings, check.meta.schema),
        toUri: (relativePath) => path.join(config.rootUri, ...relativePath.split('/')),
        toRelativePath: (uri) => path.relative(uri, config.rootUri),
        report(problem) {
            var _a;
            offenses.push({
                type: check.meta.type,
                check: check.meta.code,
                message: problem.message,
                uri: file.uri,
                severity: (_a = checkSettings === null || checkSettings === void 0 ? void 0 : checkSettings.severity) !== null && _a !== void 0 ? _a : check.meta.severity,
                start: (0, utils_1.getPosition)(file.source, problem.startIndex),
                end: (0, utils_1.getPosition)(file.source, problem.endIndex),
                fix: problem.fix,
                suggest: problem.suggest,
            });
        },
        file,
    };
}
function createSettings(checkSettings, schema) {
    var _a;
    const settings = {};
    for (const [key, schemaProp] of Object.entries(schema)) {
        settings[key] = (_a = checkSettings === null || checkSettings === void 0 ? void 0 : checkSettings[key]) !== null && _a !== void 0 ? _a : schemaProp.defaultValue();
    }
    return settings;
}
function checksOfType(type, checks) {
    return checks.filter((def) => def.meta.type === type);
}
function createCheck(check, file, config, offenses, dependencies, validateJSON) {
    const context = createContext(check, file, offenses, config, dependencies, validateJSON);
    return check.create(context);
}
function filesOfType(type, sourceCodes) {
    return sourceCodes.filter((file) => file.type === type);
}
async function checkJSONFile(check, file) {
    if (check.onCodePathStart)
        await check.onCodePathStart(file);
    if (file.ast instanceof Error)
        return;
    if (Object.keys(check).length > 0)
        await (0, visitors_1.visitJSON)(file.ast, check);
    if (check.onCodePathEnd)
        await check.onCodePathEnd(file);
}
async function checkLiquidFile(check, file) {
    if (check.onCodePathStart)
        await check.onCodePathStart(file);
    if (file.ast instanceof Error)
        return;
    if (Object.keys(check).length > 0)
        await (0, visitors_1.visitLiquid)(file.ast, check);
    if (check.onCodePathEnd)
        await check.onCodePathEnd(file);
}
//# sourceMappingURL=index.js.map