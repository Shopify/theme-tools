import { AbstractFileSystem, UriString } from '@shopify/theme-check-common';
import { AugmentedDependencies } from '../types';

export function unique<T>(array: T[]): T[] {
  return [...new Set(array)];
}

export function assertNever(module: never) {
  throw new Error(`Unknown module type ${module}`);
}

export function unexpected(): Error {
  return new Error('Unexpected code path encountered');
}

export const identity = <T>(x: T): T => x;

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

export function extname(uri: UriString): string {
  return uri.split('.').pop() || '';
}

export async function exists(fs: AbstractFileSystem, uri: UriString): Promise<boolean> {
  return fs
    .stat(uri)
    .then(() => true)
    .catch(() => false);
}

export async function acceptsLocalBlocks(
  sectionType: string,
  deps: AugmentedDependencies,
): Promise<boolean | Error> {
  const sectionSchema = await deps.getSectionSchema(sectionType);
  if (!sectionSchema) {
    return new Error('Section does not exist');
  }

  const validSchema = sectionSchema.validSchema;
  if (validSchema instanceof Error) {
    return validSchema;
  }

  return (validSchema.blocks ?? []).some((block) => {
    return block.type && 'name' in block && block.name;
  });
}
