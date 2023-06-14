/**
 * Represents an entry on themes docset.
 */
export interface DocsetEntry {
  /**
   * The name of the entry.
   */
  name: string;

  /**
   * A brief summary of the entry.
   */
  summary?: string;

  /**
   * A detailed description of the entry.
   */
  description?: string;

  /**
   * Whether the entry is deprecated or not.
   */
  deprecated?: boolean;

  /**
   * The documentation link.
   */
  link?: string;

  /**
   * The reason why the entry is deprecated.
   */
  deprecationReason?: string;

  /**
   * The return type of the entry.
   */
  returnRype?: string;
}

/**
 * Filter entry.
 */
export interface FilterEntry extends DocsetEntry {
  parameters?: DocsetEntry[];
}

/**
 * Object entry.
 */
export interface ObjectEntry extends DocsetEntry {
  properties?: DocsetEntry[];
}

/**
 * Tag entry.
 */
export interface TagEntry extends DocsetEntry {
  parameters?: DocsetEntry[];
}

export type JsonSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null';

export interface JsonSchema {
  $id?: string;
  $schema?: string;
  $ref?: string;
  description?: string;
  type?: JsonSchemaType | JsonSchemaType[];
  required?: string[];
  properties?: { [key: string]: JsonSchema };
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema | JsonSchema[];
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  pattern?: string;
  format?: string;
  enum?: any[];
  const?: any;
  multipleOf?: number;
  definitions?: { [key: string]: JsonSchema };
  dependencies?: { [key: string]: JsonSchema | string[] };
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  not?: JsonSchema;
  if?: JsonSchema;
  then?: JsonSchema;
  else?: JsonSchema;
}

/**
 * Shopify themes docset.
 */
export interface ThemeDocset {
  /**
   * Returns Liquid filters available on themes.
   */
  filters(): Promise<FilterEntry[]>;

  /**
   * Returns objects (or Liquid variables) available on themes.
   */
  objects(): Promise<ObjectEntry[]>;

  /**
   * Returns Liquid tags available on themes.
   */
  tags(): Promise<TagEntry[]>;
}

/**
 * JSON schemas resources for themes.
 */
export interface ThemeSchemas {
  /**
   * Retrieves the JSON Schema for theme sections.
   */
  sectionSchema(): Promise<JsonSchema>;
}
