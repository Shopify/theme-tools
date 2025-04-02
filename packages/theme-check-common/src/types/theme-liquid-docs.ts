import { Mode, Translations } from '..';

/**
 * Shopify themes docset.
 */
export interface ThemeDocset {
  /** Whether it was augmented prior to being passed. */
  isAugmented?: boolean;

  /** Returns Liquid filters available on themes. */
  filters(): Promise<FilterEntry[]>;

  /** Returns objects (or Liquid variables) available on themes. */
  objects(): Promise<ObjectEntry[]>;

  /** Returns objects (excluding global variables, hidden objects, and deprecated objects) available on themes. */
  liquidDrops(): Promise<ObjectEntry[]>;

  /** Returns Liquid tags available on themes. */
  tags(): Promise<TagEntry[]>;

  /** Returns system translations available on themes. */
  systemTranslations(): Promise<Translations>;
}

/** A URI that will uniquely describe the schema */
export type JSONSchemaURI = string;

export interface SchemaDefinition {
  /** A URI that will uniquely describe the schema */
  uri: JSONSchemaURI;

  /** A JSON Schema as string */
  schema: string;

  /**
   * When absent, does not match on file. Assumed to be used by other
   * schemas.
   *
   * e.g. '\*\*\/sections\/\*.liquid', '\*\*\/locales\/*.json'
   */
  fileMatch?: string[];
}

/** Source of JSON schemas for themes. */
export interface JsonValidationSet {
  /** All relevant SchemaDefinitions. */
  schemas: (mode: Mode) => Promise<SchemaDefinition[]>;
}

export interface DocsetEntry {
  /** The name of the entry. */
  name: string;

  /** A brief summary of the entry. */
  summary?: string;

  /** A detailed description of the entry. */
  description?: string;

  /** Whether the entry is deprecated or not. */
  deprecated?: boolean;

  /** The reason why the entry is deprecated. */
  deprecation_reason?: string;

  /** documentation examples */
  examples?: Example[];
}

export interface ObjectEntry extends DocsetEntry {
  /**
   * Holds the information on whether an ObjectEntry refers to a type or global variable.
   *
   * When not defined, we assume it's a global.
   */
  access?: Access;

  /**
   * Object properties and their types
   */
  properties?: ObjectEntry[];

  /**
   * The return type of the variable.
   * When multiple, it's because the return value is an enum (e.g. video | image).
   */
  return_type?: ReturnType[];

  /** Don't care about this */
  json_data?: JsonData;
}

export interface FilterEntry extends DocsetEntry {
  /** Used for categorization on the docs website */
  category?: string;

  /** Argument types */
  parameters?: Parameter[];

  /** Return type */
  return_type?: ReturnType[];

  /** e.g. cart | item_count_for_variant: {variant_id} */
  syntax?: string;
}

export interface TagEntry extends DocsetEntry {
  /** Used for categorization on the docs website */
  category?: string;

  /** Argument types */
  parameters?: Parameter[];

  /** e.g. {% for item in array %}\n  expression{% endfor %} */
  syntax?: string;

  /** e.g. item, array, expression */
  syntax_keywords?: SyntaxKeyword[];
}

export interface Access {
  /** Whether the ObjectEntry is a global variable or a type */
  global: boolean;
  parents: Parent[];
  template: string[];
}

export interface Parent {
  object: string;
  property: string;
}

export interface Parameter {
  description: string;
  name: string;
  positional: boolean;
  required: boolean;
  types: string[];
}

export interface SyntaxKeyword {
  description: string;
  keyword: string;
}

export interface Example {
  /* don't care about this */
  // description: string;
  // display_type: string;
  // name: string;
  // parameter: boolean;
  // path: string;
  // raw_liquid: string;
  // show_data_tab: boolean;
  // syntax: string;
}

export interface JsonData {
  /* don't care about those */
  // data_from_file: string;
  // handle: string;
  // path: string;
}

export type ReturnType = EnumReturnType | ArrayReturnType | OtherReturnType;

export interface EnumReturnType {
  type: 'string';
  name: string;
}

export interface ArrayReturnType {
  type: 'array';
  array_value: string;
}

export interface OtherReturnType {
  type: 'string' | 'number' | 'untyped' | string;
  name: '';
}
