export type Schema = {
  [key: string]: SchemaProp<any>;
};

export type SchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export type SettingValue<T extends SchemaProp<any>> = T extends SchemaProp<infer U> ? U : never;

export type Settings<S extends Schema> = {
  [K in keyof S]: SettingValue<S[K]>;
};

export interface SchemaPropOptions<T> {
  type: SchemaType;
  defaultValue?: T;
  optional?: boolean;
  properties?: Schema;
  itemType?: SchemaProp<any>;
}

export class SchemaProp<T> {
  options: SchemaPropOptions<T>;

  constructor(options: SchemaPropOptions<T>) {
    this.options = options;
  }

  /** Creates a string setting definition */
  static string(defaultValue?: string): SchemaProp<string> {
    return new SchemaProp({ type: 'string', defaultValue });
  }

  /** Creates a number setting definition */
  static number(defaultValue?: number): SchemaProp<number> {
    return new SchemaProp({ type: 'number', defaultValue });
  }

  /** Creates a boolean setting definition */
  static boolean(defaultValue?: boolean): SchemaProp<boolean> {
    return new SchemaProp({ type: 'boolean', defaultValue });
  }

  /**
   * Creates an object setting definition
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
   * @returns a schema property definition for an object type
   */
  static object<S extends Schema>(
    /** The schema of the object's properties */
    properties: S,
    defaultValue?: Settings<S>,
  ): SchemaProp<Settings<S>> {
    const schema = new SchemaProp({ type: 'object', defaultValue, properties });
    return schema;
  }

  /**
   * Creates an array setting definition
   *
   * Usage:
   * ```
   * const schema = {
   *   numbers: SchemaProp.array(SchemaProp.number(), [0, 1]),
   *   strings: SchemaProp.array(SchemaProp.string(), ["foo", "bar"]),
   *   users: SchemaProp.array(SchemaProp.object({
   *    name: SchemaProp.string(),
   *    age: SchemaProp.number(),
   *   })),
   * };
   * ```
   *
   * @param itemType the type of the items in the array
   * @returns a schema property definition for an object type
   */
  static array<SP extends SchemaProp<any>>(
    /** The schema prop type of the items in the array */
    itemType: SP,
    defaultValue?: Array<SettingValue<SP>>,
  ): SchemaProp<Array<SettingValue<SP>>> {
    const schema = new SchemaProp({ type: 'array', defaultValue, itemType });
    return schema;
  }

  /**
   * A schema prop can be optional, making the setting T | undefined.
   *
   * Usage:
   * ```
   * const Schema = {
   *   age: SchemaProp.number().optional(),
   * }
   * ```
   */
  optional(): SchemaProp<T | undefined> {
    this.options.optional = true;
    return this as unknown as SchemaProp<T | undefined>;
  }

  defaultValue(): T | undefined {
    return this.options.defaultValue;
  }
}
