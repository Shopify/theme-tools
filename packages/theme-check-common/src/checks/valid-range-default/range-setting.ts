import { JSONNode, ObjectNode, isArrayNode, isLiteralNode, isObjectNode } from '../../types';

// Shared by ValidRangeDefault and ValidRangeStepCount.

/** Absorbs float error, so `step: 0.1, default: 4.7` counts as on the grid. */
export const EPSILON = 1e-9;

/** A `range` setting with numeric bounds. */
export type RangeSetting = {
  id: string;
  min: number;
  max: number;
  /** 1 when the setting has no `step`, as on the storefront. */
  step: number;
  default?: unknown;
};

/** A list of setting definitions and its path in the schema. */
export type SettingDefinitions = {
  path: (string | number)[];
  settings: unknown[];
};

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The range setting that `setting` defines, or undefined when it isn't a
 * range setting or its id, min, max or step is invalid. Those are left to
 * ValidSchema. Like the storefront, this needs `max` to be greater than `min`.
 */
export function toRangeSetting(setting: unknown): RangeSetting | undefined {
  if (!setting || typeof setting !== 'object') return;
  const { type, id, min, max, step = 1 } = setting as Record<string, unknown>;
  if (type !== 'range' || typeof id !== 'string') return;
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || !isFiniteNumber(step)) return;
  if (step <= 0 || max <= min) return;
  return { id, min, max, step, default: (setting as Record<string, unknown>).default };
}

/**
 * The setting definitions of a `{% schema %}`: its own settings, then the
 * settings of each of its local blocks.
 */
export function settingDefinitions(schema: {
  settings?: unknown;
  blocks?: unknown;
}): SettingDefinitions[] {
  const result: SettingDefinitions[] = [];
  if (Array.isArray(schema.settings)) {
    result.push({ path: ['settings'], settings: schema.settings });
  }
  if (Array.isArray(schema.blocks)) {
    schema.blocks.forEach((block, i) => {
      const settings = block && typeof block === 'object' ? block.settings : undefined;
      if (Array.isArray(settings)) result.push({ path: ['blocks', i, 'settings'], settings });
    });
  }
  return result;
}

/**
 * A JSON object's literal properties as plain values. Other values become
 * null, so they never read as a missing `step`.
 */
export function literalValues(node: ObjectNode): Record<string, unknown> {
  const values: Record<string, unknown> = Object.create(null);
  for (const property of node.children) {
    values[property.key.value] = isLiteralNode(property.value) ? property.value.value : null;
  }
  return values;
}

/**
 * Like `nodeAtPath`, but an object's last property with a key wins, as in the
 * parsed schema, so the reported node holds the value that was checked.
 */
export function lastNodeAtPath(node: JSONNode, path: (string | number)[]): JSONNode | undefined {
  let current: JSONNode | undefined = node;
  for (const key of path) {
    if (!current) return;
    if (isObjectNode(current)) {
      current = typeof key === 'string' ? propertyValue(current, key) : undefined;
    } else if (isArrayNode(current)) {
      current = typeof key === 'number' ? current.children[key] : undefined;
    } else {
      return;
    }
  }
  return current;
}

/** The value of a JSON object's last `key` property, the one `literalValues` keeps. */
export function propertyValue(node: ObjectNode, key: string): JSONNode | undefined {
  for (let i = node.children.length - 1; i >= 0; i--) {
    if (node.children[i].key.value === key) return node.children[i].value;
  }
}
