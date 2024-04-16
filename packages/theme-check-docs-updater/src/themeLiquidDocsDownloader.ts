import { Mode } from '@shopify/theme-check-common';
import envPaths from 'env-paths';
import fetch from 'node-fetch';
import fs from 'node:fs/promises';
import path from 'node:path';

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

export async function downloadSchema(relativeUri: string, destination: string = root) {
  const remotePath = schemaUrl(relativeUri);
  const localPath = schemaPath(relativeUri, destination);
  const text = await download(remotePath);
  fs.writeFile(localPath, text, 'utf8');
  return text;
}

export async function downloadResource(resource: Resource | 'latest', destination: string = root) {
  const remotePath = resourceUrl(resource);
  const localPath = resourcePath(resource, destination);
  const text = await download(remotePath);
  fs.writeFile(localPath, text, 'utf8');
  return text;
}

export async function download(path: string) {
  if (path.startsWith('file:')) {
    return await fs.readFile(path.replace(/^file:/, ''), 'utf8');
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

export async function downloadThemeLiquidDocs(destination = root) {
  if (!(await exists(destination))) {
    await fs.mkdir(destination);
  }

  const resources = ['latest'].concat(Resources);
  const resourceContents = await Promise.all(
    resources.map((file) => {
      return downloadResource(file as Resource | 'latest', destination);
    }),
  );

  const manifests = Object.values(Manifests)
    .map((resource) => resources.indexOf(resource))
    .map((index) => resourceContents[index])
    .map((manifest) => JSON.parse(manifest));

  const relativeUris = manifests.flatMap((manifest) =>
    manifest.schemas.map((schema: { uri: string }) => schema.uri),
  );

  await Promise.all(unique(relativeUris).map((uri) => downloadSchema(uri, destination)));
}

function unique<T>(array: T[]): T[] {
  return [...new Set(array).values()];
}
