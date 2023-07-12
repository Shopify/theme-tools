import {
  FilterEntry,
  JsonSchema,
  ObjectEntry,
  TagEntry,
  ThemeDocset,
  ThemeSchemas,
} from '@shopify/theme-check-common';
import { ValidateFunction } from 'ajv';
import fs from 'node:fs/promises';
import { compileJsonSchema } from './jsonSchemaCompiler';
import { Resource, Resources } from './themeLiquidDocsDownloader';
import { download, filePath, memo, noop } from './utils';

type Logger = (message: string) => void;

export class ThemeLiquidDocsManager implements ThemeDocset, ThemeSchemas {
  constructor(private log: Logger = noop) {}

  // These methods are memoized so that they both are lazy and cached with
  // minimal amount of state lying around.
  filters = memo(async (): Promise<FilterEntry[]> => {
    return this.loadResource('filters', []);
  });

  objects = memo(async (): Promise<ObjectEntry[]> => {
    return this.loadResource('objects', []);
  });

  tags = memo(async (): Promise<TagEntry[]> => {
    return this.loadResource('tags', []);
  });

  sectionSchema = memo(async (): Promise<JsonSchema> => {
    return this.loadResource('section_schema', {});
  });

  sectionSchemaValidator = memo(async (): Promise<ValidateFunction<unknown>> => {
    return compileJsonSchema(await this.sectionSchema());
  });

  /**
   * The setup method checks that the latest revision matches the one from
   * Shopify/theme-liquid-docs. If there's a diff in revision, it means
   * that the documentations that you have locally are out of date.
   *
   * The setup method then downloads the other files.
   */
  setup = memo(async (): Promise<void> => {
    const local = await this.latestRevision();
    await download('latest');
    const remote = await this.latestRevision();
    if (local !== remote) {
      await Promise.all(Resources.map((resource) => download(resource)));
    }
  });

  private async loadResource<T>(name: Resource, defaultValue: T) {
    // Always wait for setup first. Since it's memoized, this will always
    // be the same promise.
    await this.setup();
    return this.load(name, defaultValue);
  }

  private async load<T>(name: Resource | 'latest', defaultValue: T) {
    try {
      const content = await fs.readFile(filePath(name), 'utf8');
      const json = JSON.parse(content);

      return json;
    } catch (err: any) {
      this.log(`[SERVER] Error loading theme resource (${name}), ${err.message}`);
      return defaultValue;
    }
  }

  private async latestRevision(): Promise<string> {
    const latest = await this.load('latest', {});
    return latest['revision'] ?? '';
  }
}
