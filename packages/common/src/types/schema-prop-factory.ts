import { DynamicSchema, Schema } from '../types';

/**
 * Creates a boolean property definition
 *
 * @param defaultValue `false` if not provided
 */
const boolean = (defaultValue: boolean = false) => propertyDefinition(defaultValue);

/**
 * Creates a array property definition
 *
 * @param defaultValue `[]` if not provided
 */
const array = <T extends string | number>(defaultValue: T[] = []) =>
  propertyDefinition(defaultValue);

/**
 * Creates a number property definition
 *
 * @param defaultValue `0` if not provided
 */
const number = (defaultValue: number = 0) => propertyDefinition(defaultValue);

/**
 * Creates a string property definition
 *
 * @param defaultValue `''` if not provided
 *
 */
const string = (defaultValue: string = '') => propertyDefinition(defaultValue);

/**
 * Creates an object schema property definition
 *
 * Usage:
 * ```
 * const schema = {
 *   user: SchemaProp.object({
 *     age: SchemaProp.number(),
 *     name: SchemaProp.string(),
 *   })
 * };
 * ```
 *
 * @param properties the nested schema properties of the object.
 *
 * @param defaultValue `{}` if not provided
 *
 * @returns a schema property definition for an object type
 */
const object = <T extends Schema>(properties: T = {} as T, defaultValue: object = {}) => ({
  properties,
  defaultValue,
  optional: () => ({ defaultValue: defaultValue as DynamicSchema<T> | undefined }),
});

export const SchemaPropFactory = {
  boolean,
  array,
  number,
  string,
  object,
};

const propertyDefinition = <T>(defaultValue: T) => ({
  defaultValue,
  optional: () => ({ defaultValue: defaultValue as T | undefined }),
});
