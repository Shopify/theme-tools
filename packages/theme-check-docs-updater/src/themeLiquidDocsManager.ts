import {
  FilterEntry,
  ObjectEntry,
  TagEntry,
  ThemeDocset,
  JsonSchemaValidators,
  Translations,
} from '@shopify/theme-check-common';
import { ValidateFunction } from 'ajv';
import fs from 'node:fs/promises';
import { compileJsonSchema } from './jsonSchemaCompiler';
import { Resource, Resources, exists } from './themeLiquidDocsDownloader';
import { download, filePath, memo, noop, root } from './utils';

type Logger = (message: string) => void;

export class ThemeLiquidDocsManager implements ThemeDocset, JsonSchemaValidators {
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

  systemTranslations = memo(async (): Promise<Translations> => {
    return this.loadResource('shopify_system_translations', {});
  });

  validateSectionSchema = memo(async (): Promise<ValidateFunction> => {
    const sectionSchema = await this.loadResource('section_schema', {});
    return compileJsonSchema(sectionSchema);
  });

  /**
   * The setup method checks that the latest revision matches the one from
   * Shopify/theme-liquid-docs. If there's a diff in revision, it means
   * that the documentations that you have locally are out of date.
   *
   * The setup method then downloads the other files.
   */
  setup = memo(async (): Promise<void> => {
    if (!(await exists(root))) {
      await fs.mkdir(root, { recursive: true });
    }

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
