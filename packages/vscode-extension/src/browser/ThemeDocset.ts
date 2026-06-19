import { memo } from '@shopify/theme-check-common';
import { Dependencies } from '@shopify/theme-language-server-browser';
import { Connection } from 'vscode-languageserver/browser';

/**
 * These are replaced at build time by the contents of
 * @shopify/theme-check-docs-updater's DocsManager
 */
declare global {
  export const WEBPACK_TAGS: any[];
  export const WEBPACK_FILTERS: any[];
  export const WEBPACK_OBJECTS: any[];
  export const WEBPACK_SYSTEM_TRANSLATIONS: any;
  export const WEBPACK_SCHEMAS: any;
}

const RemoteDocsSchemaVersion = 1;
const RemoteDocsIndexPath = '/liquid-docs/v1/latest.json';
const RemoteDocsIndexConfiguration = 'shopifyLiquid.remoteLiquidDocsUrl';

type ThemeDocset = NonNullable<Dependencies['themeDocset']>;
type JsonValidationSet = NonNullable<Dependencies['jsonValidationSet']>;

type ThemeDocs = {
  filters: Awaited<ReturnType<ThemeDocset['filters']>>;
  tags: Awaited<ReturnType<ThemeDocset['tags']>>;
  objects: Awaited<ReturnType<ThemeDocset['objects']>>;
  systemTranslations: Awaited<ReturnType<ThemeDocset['systemTranslations']>>;
  schemas: Awaited<ReturnType<JsonValidationSet['schemas']>>;
};

type RemoteThemeDocs = ThemeDocs & {
  schemaVersion: typeof RemoteDocsSchemaVersion;
  revision: string;
};

type RemoteThemeDocsIndex = {
  schemaVersion: typeof RemoteDocsSchemaVersion;
  revision: string;
  url: string;
};

const bundledDocs: ThemeDocs = {
  tags: WEBPACK_TAGS,
  filters: WEBPACK_FILTERS,
  objects: WEBPACK_OBJECTS,
  systemTranslations: WEBPACK_SYSTEM_TRANSLATIONS,
  schemas: WEBPACK_SCHEMAS,
};

export class ThemeDocsetManager implements ThemeDocset, JsonValidationSet {
  constructor(
    private connection: Connection,
    private log: (message: string) => void = () => {},
  ) {}

  filters = memo(async () => (await this.docs()).filters);
  tags = memo(async () => (await this.docs()).tags);
  objects = memo(async () => (await this.docs()).objects);
  liquidDrops = memo(async () => (await this.docs()).objects);
  systemTranslations = memo(async () => (await this.docs()).systemTranslations);
  schemas = memo(async () => (await this.docs()).schemas);

  private docs = memo((): Promise<ThemeDocs> => {
    return this.remoteDocsIndexUrl()
      .then(fetchRemoteDocs)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.log(`Unable to load remote Liquid docs; using bundled docs. ${message}`);
        return bundledDocs;
      });
  });

  private remoteDocsIndexUrl = memo((): Promise<string | undefined> => {
    return this.connection.workspace
      .getConfiguration({ section: RemoteDocsIndexConfiguration })
      .then((url) => (typeof url === 'string' && url.trim() ? url.trim() : undefined))
      .catch(() => undefined);
  });
}

async function fetchRemoteDocs(remoteDocsIndexUrl?: string): Promise<RemoteThemeDocs> {
  const latestUrl = resolveRemoteDocsIndexUrl(remoteDocsIndexUrl);
  const latest = await fetchJson(latestUrl);

  if (isRemoteThemeDocs(latest)) return latest;
  if (!isRemoteThemeDocsIndex(latest)) throw new Error('Invalid remote Liquid docs index.');

  const bundleUrl = new URL(latest.url, latestUrl);
  if (bundleUrl.origin !== latestUrl.origin) {
    throw new Error('Remote Liquid docs bundle URLs must use the same origin as the index.');
  }

  const bundle = await fetchJson(bundleUrl);
  if (!isRemoteThemeDocs(bundle)) throw new Error('Invalid remote Liquid docs bundle.');
  if (bundle.revision !== latest.revision) {
    throw new Error('Remote Liquid docs index and bundle revisions do not match.');
  }

  return bundle;
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(
      `Failed to fetch remote Liquid docs: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function resolveRemoteDocsIndexUrl(remoteDocsIndexUrl?: string): URL {
  if (remoteDocsIndexUrl) return new URL(remoteDocsIndexUrl);
  return new URL(RemoteDocsIndexPath, workerOrigin());
}

function workerOrigin(): string {
  const location = (globalThis as unknown as { location?: { origin?: string } }).location;

  if (!location?.origin || location.origin === 'null') {
    throw new Error('Unable to determine the Code Editor origin for remote Liquid docs.');
  }

  return location.origin;
}

function isRemoteThemeDocs(value: unknown): value is RemoteThemeDocs {
  return (
    hasSupportedMetadata(value) &&
    Array.isArray(value.filters) &&
    Array.isArray(value.tags) &&
    Array.isArray(value.objects) &&
    Array.isArray(value.schemas) &&
    isRecord(value.systemTranslations)
  );
}

function isRemoteThemeDocsIndex(value: unknown): value is RemoteThemeDocsIndex {
  return hasSupportedMetadata(value) && typeof value.url === 'string' && value.url.length > 0;
}

function hasSupportedMetadata(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    value.schemaVersion === RemoteDocsSchemaVersion &&
    typeof value.revision === 'string' &&
    value.revision.length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
