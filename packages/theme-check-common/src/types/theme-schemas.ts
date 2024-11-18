import { SourceCode, SourceCodeType } from '../types';
import { Section, ThemeBlock } from './schemas';

export * from './schemas';

export enum ThemeSchemaType {
  AppBlock = 'app-block',
  Block = 'block',
  Section = 'section',
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
export interface ThemeBlockSchema extends ThemeSchema<ThemeSchemaType.Block> {
  /**
   * @example
   * const schema = await context.getBlockSchema('product');
   * const validSchema = schema?.validSchema;
   * if (!validSchema || validSchema instanceof Error) return;
   *
   * for (const block of validSchema.blocks ?? []) {
   *  // do something
   * }
   */
  validSchema: ThemeBlock.Schema | Error;
}

/** See {@link ThemeSchema} */
export interface SectionSchema extends ThemeSchema<ThemeSchemaType.Section> {
  /**
   * @example
   * const schema = await context.getSectionSchema('product');
   * const validSchema = schema?.validSchema;
   * if (!validSchema || validSchema instanceof Error) return;
   *
   * for (const block of validSchema.blocks ?? []) {
   *  // do something
   * }
   */
  validSchema: Section.Schema | Error;
}

/** TODO setup validSchema like the other ones. */
export interface AppBlockSchema extends ThemeSchema<ThemeSchemaType.AppBlock> {}
