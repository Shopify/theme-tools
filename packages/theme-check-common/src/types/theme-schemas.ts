import { SourceCode, SourceCodeType } from '../types';

/** Doubles as the folder name */
export enum ThemeSchemaType {
  Block = 'blocks',
  Section = 'sections',
}

/**
 * A ThemeSchema represents the `{% schema %}` contents of a block or section file.
 *
 * `ast` and `parsed` will be instances of `Error` if there was an error parsing
 * the Liquid file or the JSON.
 *
 * There is no guarantee that the `ast` or `parsed` fields are backend-valid.
 */
export interface ThemeSchema<T extends ThemeSchemaType> {
  /** section or block */
  type: T;

  /** `section/${name}.liquid` */
  name: string;

  /** Parsed as an AST (with position information) or an Error */
  ast: SourceCode<SourceCodeType.JSON>['ast'] | Error;

  /** Parsed as a JavaScript object or an Error */
  parsed: any | Error;
}

/** See {@link ThemeSchema} */
export interface BlockSchema extends ThemeSchema<ThemeSchemaType.Block> {}

/** See {@link ThemeSchema} */
export interface SectionSchema extends ThemeSchema<ThemeSchemaType.Section> {}
