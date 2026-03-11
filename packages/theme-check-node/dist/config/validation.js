"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = validateConfig;
const node_assert_1 = require("node:assert");
function validateConfig(config) {
    for (const check of config.checks) {
        const settings = config.settings[check.meta.code];
        (0, node_assert_1.strict)(settings, `Unexpected missing settings for ${check.meta.code} in validateConfig call`);
        validateSettings(check.meta.code, check.meta.schema, settings, true);
    }
}
function validateSettings(checkCode, schema, settings, isTopLevel) {
    for (const key in schema) {
        const schemaProp = schema[key];
        const settingValue = settings[key];
        validateValue(key, settingValue, schemaProp);
    }
    if (isTopLevel) {
        validateCommonCheckSettings(settings);
    }
    validateSuperfluousSettings(checkCode, schema, settings);
}
function validateCommonCheckSettings(settings) {
    const { severity, enabled, ignore } = settings;
    severity === undefined || assertType('severity', 'number', typeof severity);
    assertType('enabled', 'boolean', typeof enabled);
    ignore === undefined || assertArray('ignore', ignore);
}
function validateSuperfluousSettings(checkCode, schema, settings) {
    const commonCheckSettingsKeys = ['enabled', 'severity', 'ignore'];
    for (const key in settings) {
        if (!(key in schema) && !commonCheckSettingsKeys.includes(key)) {
            console.error(`Unexpected setting: ${key} for check ${checkCode} found in configuration`);
        }
    }
}
function validateValue(key, value, schemaProp) {
    const { type, optional, defaultValue, properties, itemType } = schemaProp.options;
    if (value === undefined) {
        if (optional !== true && defaultValue === undefined) {
            throw new Error(`Missing required setting: ${key}`);
        }
        return;
    }
    if (defaultValue !== undefined && value === defaultValue) {
        return;
    }
    switch (type) {
        case 'string':
        case 'number':
        case 'boolean': {
            assertType(key, type, typeof value);
            break;
        }
        case 'object': {
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                throw new Error(`Invalid type for setting ${key}: expected object, got ${typeof value}`);
            }
            for (const nestedKey in properties) {
                validateValue(nestedKey, value[nestedKey], properties[nestedKey]);
            }
            break;
        }
        case 'array': {
            assertArray(key, value);
            if (itemType) {
                for (const item of value) {
                    validateValue(key, item, itemType);
                }
            }
            break;
        }
        default: {
            throw new Error(`Unexpected setting type: ${type}`);
        }
    }
}
const typeOf = (thing) => typeof thing;
function assertType(key, expectedType, actualType) {
    node_assert_1.strict.strictEqual(actualType, expectedType, `Invalid type for setting ${key}: expected ${expectedType}, got ${actualType}`);
}
function assertArray(key, thing) {
    node_assert_1.strict.ok(Array.isArray(thing), `Invalid type for setting ${key}: expected array, got ${typeof thing}`);
}
//# sourceMappingURL=validation.js.map