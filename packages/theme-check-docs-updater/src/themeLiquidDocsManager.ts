import {
  FilterEntry,
  JsonValidationSet,
  ObjectEntry,
  TagEntry,
  ThemeDocset,
  Translations,
  indexBy,
} from '@shopify/theme-check-common';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Resource, Resources, exists } from './themeLiquidDocsDownloader';
import { download, filePath, memo, noop, root } from './utils';

type Logger = (message: string) => void;

const SectionSchemaURI =
  'https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/schemas/theme/section_schema.json';

const TranslationFileURI =
  'https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/schemas/theme/translations_schema.json';

export class ThemeLiquidDocsManager implements ThemeDocset, JsonValidationSet {
  constructor(private log: Logger = noop) {}

  filters = memo(async (): Promise<FilterEntry[]> => {
    return findSuitableResource(this.loaders('filters'), JSON.parse, []);
  });

  objects = memo(async (): Promise<ObjectEntry[]> => {
    return findSuitableResource(this.loaders('objects'), JSON.parse, []);
  });

  tags = memo(async (): Promise<TagEntry[]> => {
    return findSuitableResource(this.loaders('tags'), JSON.parse, []);
  });

  systemTranslations = memo(async (): Promise<Translations> => {
    return findSuitableResource(this.loaders('shopify_system_translations'), JSON.parse, {});
  });

  schemas = [
    {
      uri: SectionSchemaURI,
      fileMatch: ['**/sections/*.liquid'],
      schema: findSuitableResource(this.loaders('section_schema'), identity, '{}'),
    },
    {
      uri: TranslationFileURI,
      fileMatch: [
        '**/locales/*.json',
        '**/locales/*.default.json',
        '**/locales/*.schema.json',
        '**/locales/*.default.schema.json',
      ],
      schema: findSuitableResource(this.loaders('translations_schema'), identity, '{}'),
    },
  ];

  /**
   * The setup method checks that the latest revision matches the one from
   * Shopify/theme-liquid-docs. If there's a diff in revision, it means
   * that the documentations that you have locally are out of date.
   *
   * The setup method then downloads the other files.
   */
  setup = memo(async (): Promise<void> => {
    try {
      if (!(await exists(root))) {
        await fs.mkdir(root, { recursive: true });
      }

      const local = await this.latestRevision();
      await download('latest');
      const remote = await this.latestRevision();
      if (local !== remote) {
        await Promise.all(Resources.map((resource) => download(resource)));
      }
    } catch (error) {
      if (error instanceof Error) this.log(error.message);
      return;
    }
  });

  private async latestRevision(): Promise<string> {
    const latest = await findSuitableResource([() => this.load('latest')], JSON.parse, {});
    return latest['revision'] ?? '';
  }

  private async loadResource(name: Resource): Promise<string> {
    // Always wait for setup first. Since it's memoized, this will always
    // be the same promise.
    await this.setup();
    return this.load(name);
  }

  private async load(name: Resource | 'latest') {
    return fs.readFile(filePath(name), 'utf8');
  }

  private loaders(name: Resource) {
    return [() => this.loadResource(name), () => fallback(name)];
  }
}

const identity = <T>(x: T): T => x;

/**
 * Find the first resource that can be loaded and transformed.
 *
 * Will try to load the resource from the loaders in order. If the loader
 * throws an error, it will try the next loader. If all loaders throw an
 * error, it will return the default value.
 *
 * This should allow us to load the latest version of the resource if it's
 * available, and fall back to the local version if it's not. If neither
 * work, we'll just return the default value.
 */
async function findSuitableResource<B, A = string>(
  dataLoaders: (() => Promise<A>)[],
  transform: (x: A) => B,
  defaultValue: B,
): Promise<B> {
  for (const loader of dataLoaders) {
    try {
      return transform(await loader());
    } catch (_) {
      continue;
    }
  }
  return defaultValue;
}

/**
 * The root directory for the data files. This is different in the VS Code build
 * (since those files are copied to the dist folder at a different relative path)
 */
function dataRoot() {
  if (process.env.WEBPACK_MODE) {
    return path.resolve(__dirname, './data');
  } else {
    return path.resolve(__dirname, '../data');
  }
}

/** Returns the at-build-time path to the fallback data file. */
async function fallback(name: Resource): Promise<string> {
  return fs.readFile(path.resolve(dataRoot(), `${name}.json`), 'utf8');
}
