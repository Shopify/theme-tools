import fs from 'node:fs/promises';
import fetch from 'node-fetch';
import path from 'node:path';

export type Resource = (typeof Resources)[number];
export const Resources = [
  'filters',
  'objects',
  'tags',
  'section_schema',
  'translations_schema',
  'shopify_system_translations',
] as const;

const THEME_LIQUID_DOCS: Record<Resource | 'latest', string> = {
  filters: 'data/filters.json',
  objects: 'data/objects.json',
  tags: 'data/tags.json',
  latest: 'data/latest.json',
  section_schema: 'schemas/theme/section_schema.json',
  translations_schema: 'schemas/theme/translations_schema.json',
  shopify_system_translations: 'data/shopify_system_translations.json',
};

export async function downloadFile(file: Resource | 'latest', destination: string) {
  const remotePath = buildRemotePath(file);
  const localPath = buildLocalPath(file, destination);

  const res = await fetch(remotePath);
  const text = await res.text();

  return fs.writeFile(localPath, text, 'utf8');
}

function buildRemotePath(file: Resource | 'latest') {
  const relativePath = THEME_LIQUID_DOCS[file];
  return `https://raw.githubusercontent.com/Shopify/theme-liquid-docs/main/${relativePath}`;
}

function buildLocalPath(file: string, destination: string) {
  return path.join(destination, `${file}.json`);
}

export async function exists(path: string) {
  try {
    await fs.stat(path);
    return true;
  } catch (e) {
    return false;
  }
}

export async function downloadThemeLiquidDocs(outputDir: string) {
  if (!(await exists(outputDir))) {
    await fs.mkdir(outputDir);
  }

  const promises = ['latest'].concat(Resources).map((file) => {
    return downloadFile(file as Resource | 'latest', outputDir);
  });

  await Promise.all(promises);
}
