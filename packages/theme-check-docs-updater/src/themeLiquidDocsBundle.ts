import {
  FilterEntry,
  ObjectEntry,
  SchemaDefinition,
  TagEntry,
  Translations,
} from '@shopify/theme-check-common';
import { ThemeLiquidDocsManager } from './themeLiquidDocsManager';

export const ThemeLiquidDocsBundleSchemaVersion = 1;

export interface ThemeLiquidDocsBundle {
  schemaVersion: typeof ThemeLiquidDocsBundleSchemaVersion;
  revision: string;
  tags: TagEntry[];
  filters: FilterEntry[];
  objects: ObjectEntry[];
  systemTranslations: Translations;
  schemas: SchemaDefinition[];
}

export interface ThemeLiquidDocsBundleManager {
  revision(): Promise<string>;
  tags(): Promise<TagEntry[]>;
  filters(): Promise<FilterEntry[]>;
  objects(): Promise<ObjectEntry[]>;
  systemTranslations(): Promise<Translations>;
  schemas(mode: 'theme'): Promise<SchemaDefinition[]>;
}

export async function buildThemeLiquidDocsBundle(
  docsManager: ThemeLiquidDocsBundleManager = new ThemeLiquidDocsManager(),
): Promise<ThemeLiquidDocsBundle> {
  const [revision, tags, filters, objects, systemTranslations, schemas] = await Promise.all([
    docsManager.revision(),
    docsManager.tags(),
    docsManager.filters(),
    docsManager.objects(),
    docsManager.systemTranslations(),
    docsManager.schemas('theme'),
  ]);

  if (!revision) {
    throw new Error('Unable to determine the theme-liquid-docs revision.');
  }

  return {
    schemaVersion: ThemeLiquidDocsBundleSchemaVersion,
    revision,
    tags,
    filters,
    objects,
    systemTranslations,
    schemas,
  };
}
