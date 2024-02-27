import { Translations } from '..';

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

  /** Returns Liquid tags available on themes. */
  tags(): Promise<TagEntry[]>;

  /** Returns system translations available on themes. */
  systemTranslations(): Promise<Translations>;
}

/**
 * JSON schemas resources for themes.
 */
export interface JsonValidationSet {
  /** Whether it was augmented prior to being passed. */
  isAugmented?: boolean;

  /** Retrieves the JSON schema validator for theme sections. */
  validateSectionSchema(): Promise<ValidateFunction>;

  /** Retrieves the JSON schema of the {% schema %} JSON blobs in sections/*.liquid files */
  sectionSchema(): Promise<string>;

  /** Retrieves the JSON schema of the locales/*.json files */
  translationSchema(): Promise<string>;
}

/**
 * This is a shallow redefinition of the ajv ValidateFunction.
 *
 * While theme-check was written with ajv validators in mind, you can
 * use any other validator as long as it implements this interface
 */
export interface ValidateFunction<T = unknown> {
  (data: T): boolean | Promise<boolean>;
  errors?: null | { instancePath: string; message?: string }[];
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
