import { Config, CheckSettings, Schema, SchemaProp } from '@shopify/theme-check-common';
import { strict as assert } from 'node:assert';

export function validateConfig(config: Config) {
  for (const check of config.checks) {
    const settings = config.settings[check.meta.code];
    assert(settings, `Unexpected missing settings for ${check.meta.code} in validateConfig call`);
    validateSettings(check.meta.schema, settings, true);
  }
}

function validateSettings(schema: Schema, settings: CheckSettings, isTopLevel: boolean) {
  for (const key in schema) {
    const schemaProp = schema[key];
    const settingValue = settings[key];
    validateValue(key, settingValue, schemaProp);
  }

  if (isTopLevel) {
    validateCommonCheckSettings(settings);
  }

  validateSuperfluousSettings(schema, settings);
}

function validateCommonCheckSettings(settings: CheckSettings) {
  const { severity, enabled, ignore } = settings;
  severity === undefined || assertType('severity', 'number', typeof severity);
  assertType('enabled', 'boolean', typeof enabled);
  ignore === undefined || assertArray('ignore', ignore);
}

function validateSuperfluousSettings(schema: Schema, settings: CheckSettings) {
  const commonCheckSettingsKeys = ['enabled', 'severity', 'ignore'];
  for (const key in settings) {
    if (!(key in schema) && !commonCheckSettingsKeys.includes(key)) {
      assert.fail(`Unexpected setting: ${key}`);
    }
  }
}

function validateValue(key: string, value: unknown, schemaProp: SchemaProp<any>): void {
  const { type, optional, defaultValue, properties, itemType } = schemaProp.options;

  if (value === undefined) {
    if (optional !== true) {
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
        validateValue(nestedKey, (value as any)[nestedKey], properties[nestedKey]);
      }

      break;
    }

    case 'array': {
      assertArray(key, value);
      if (itemType) {
        for (const item of value as any[]) {
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

const typeOf = (thing: unknown) => typeof thing;

function assertType(
  key: string,
  expectedType: ReturnType<typeof typeOf>,
  actualType: ReturnType<typeof typeOf>,
) {
  assert.strictEqual(
    actualType,
    expectedType,
    `Invalid type for setting ${key}: expected ${expectedType}, got ${actualType}`,
  );
}

function assertArray(key: string, thing: unknown) {
  assert.ok(
    Array.isArray(thing),
    `Invalid type for setting ${key}: expected array, got ${typeof thing}`,
  );
}
