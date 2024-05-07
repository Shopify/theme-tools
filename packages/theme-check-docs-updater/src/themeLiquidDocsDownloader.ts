import { Mode } from '@shopify/theme-check-common';
import envPaths from 'env-paths';
import fetch from 'node-fetch';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Logger, noop, tap } from './utils';

const paths = envPaths('theme-liquid-docs');
export const root = paths.cache;

export const ThemeLiquidDocsRoot =
  'https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main';
export const ThemeLiquidDocsSchemaRoot = `${ThemeLiquidDocsRoot}/schemas`;

export type Resource = (typeof Resources)[number];
export const Resources = [
  'filters',
  'objects',
  'tags',
  'shopify_system_translations',
  'manifest_theme',
  'manifest_theme_app_extension',
] as const;

export const Manifests = {
  app: 'manifest_theme_app_extension',
  theme: 'manifest_theme',
} as const satisfies Record<Mode, Resource>;

const THEME_LIQUID_DOCS: Record<Resource | 'latest', string> = {
  filters: 'data/filters.json',
  objects: 'data/objects.json',
  tags: 'data/tags.json',
  latest: 'data/latest.json',
  shopify_system_translations: 'data/shopify_system_translations.json',
  manifest_theme: 'schemas/manifest_theme.json',
  manifest_theme_app_extension: 'schemas/manifest_theme_app_extension.json',
};

export async function downloadSchema(
  relativeUri: string,
  destination: string = root,
  log: Logger = noop,
) {
  const remotePath = schemaUrl(relativeUri);
  const localPath = schemaPath(relativeUri, destination);
  const text = await download(remotePath, log);
  await fs.writeFile(localPath, text, 'utf8');
  return text;
}

export async function downloadResource(
  resource: Resource | 'latest',
  destination: string = root,
  log: Logger = noop,
) {
  const remotePath = resourceUrl(resource);
  const localPath = resourcePath(resource, destination);
  const text = await download(remotePath, log);
  await fs.writeFile(localPath, text, 'utf8');
  return text;
}

export async function download(path: string, log: Logger) {
  if (path.startsWith('file:')) {
    return await fs
      .readFile(path.replace(/^file:/, ''), 'utf8')
      .then(tap(() => log(`Using local file: ${path}`)))
      .catch((error) => {
        log(`Failed to read local file: ${path}`);
        throw error;
      });
  } else {
    const res = await fetch(path);
    return res.text();
  }
}

export function resourcePath(resource: Resource | 'latest', destination: string = root) {
  return path.join(destination, `${resource}.json`);
}

export function resourceUrl(resource: Resource | 'latest') {
  const relativePath = THEME_LIQUID_DOCS[resource];
  const resourceRoot = process.env.SHOPIFY_TLD_ROOT
    ? `file:${process.env.SHOPIFY_TLD_ROOT}`
    : ThemeLiquidDocsRoot;
  return `${resourceRoot}/${relativePath}`;
}

export function schemaPath(relativeUri: string, destination: string = root) {
  return path.resolve(destination, path.basename(relativeUri));
}

export function schemaUrl(relativeUri: string) {
  const schemaRoot = process.env.SHOPIFY_TLD_ROOT
    ? `file:${process.env.SHOPIFY_TLD_ROOT}`
    : ThemeLiquidDocsRoot;
  return `${schemaRoot}/schemas/${relativeUri}`;
}

export async function exists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (e) {
    return false;
  }
}

export async function downloadThemeLiquidDocs(destination: string, log: Logger) {
  if (!(await exists(destination))) {
    await fs.mkdir(destination);
  }

  const resources = ['latest'].concat(Resources) as (Resource | 'latest')[];
  const resourceContents = await Promise.all(
    resources.map((file) => {
      return downloadResource(file, destination, log)
        .then(
          tap(() =>
            log(
              `Successfully downloaded latest resource:\n\t${resourceUrl(file)}\n\t> ${resourcePath(
                file,
                destination,
              )}`,
            ),
          ),
        )
        .catch((error) => {
          log(
            `Failed to download latest resource:\n\t${resourceUrl(file)} to\n\t${resourcePath(
              file,
              destination,
            )}\n${error}`,
          );
          throw error;
        });
    }),
  );

  const manifests = Object.values(Manifests)
    .map((resource) => resources.indexOf(resource))
    .map((index) => resourceContents[index])
    .map((manifest) => JSON.parse(manifest));

  const relativeUris = manifests.flatMap((manifest) =>
    manifest.schemas.map((schema: { uri: string }) => schema.uri),
  );

  await Promise.all(
    unique(relativeUris).map((uri) =>
      downloadSchema(uri, destination, log)
        .then(
          tap(() =>
            log(
              `Successfully downloaded schema:\n\t${schemaUrl(uri)}\n\t> ${schemaPath(
                uri,
                destination,
              )}`,
            ),
          ),
        )
        .catch((error) => {
          log(`Failed to download schema: ${uri}, ${error}`);
          throw error;
        }),
    ),
  );
}

function unique<T>(array: T[]): T[] {
  return [...new Set(array).values()];
}
