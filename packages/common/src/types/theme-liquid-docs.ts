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
 * This is a shallow redefinition of the ajv ValidateFunction.
 *
 * While theme-check was written with ajv validators in mind, you can
 * use any other validator as long as it implements this interface
 */
export interface ValidateFunction<T = unknown> {
  (data: T): boolean | Promise<boolean>;
  errors?: null | { instancePath: string; message?: string }[];
}

/**
 * JSON schemas resources for themes.
 */
export interface JsonSchemaValidators {
  /**
   * Retrieves the JSON schema validator for theme sections.
   */
  validateSectionSchema(): Promise<ValidateFunction>;
}
