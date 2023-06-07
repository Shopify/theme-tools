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

  static string(defaultValue?: string): SchemaProp<string> {
    return new SchemaProp({ type: 'string', defaultValue });
  }

  static number(defaultValue?: number): SchemaProp<number> {
    return new SchemaProp({ type: 'number', defaultValue });
  }

  static boolean(defaultValue?: boolean): SchemaProp<boolean> {
    return new SchemaProp({ type: 'boolean', defaultValue });
  }

  static object<S extends Schema>(
    properties: S,
    defaultValue?: Settings<S>,
  ): SchemaProp<Settings<S>> {
    const schema = new SchemaProp({ type: 'object', defaultValue, properties });
    return schema;
  }

  static array<SP extends SchemaProp<any>>(
    itemType: SP,
    defaultValue?: Array<SettingValue<SP>>,
  ): SchemaProp<Array<SettingValue<SP>>> {
    const schema = new SchemaProp({ type: 'array', defaultValue, itemType });
    return schema;
  }

  optional(): SchemaProp<T | undefined> {
    this.options.optional = true;
    return this as unknown as SchemaProp<T | undefined>;
  }

  defaultValue(): T | undefined {
    return this.options.defaultValue;
  }
}
