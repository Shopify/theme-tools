import type { ExecOptions } from 'child_process';

/**
 * Child_process types do not have a good definition for options so we need to
 * do this silly wrapping so typescript can chill out.
 */
export type RunOptions = {
  encoding: string;
} & ExecOptions;

export type StepFunction = (arg?: any) => Promise<any> | void;

interface Release {
  name: string;
  type: string;
  oldVersion?: string;
  changesets?: string[];
  newVersion?: string;
}

export interface Changeset {
  releases: Release[];
  summary: string;
  id: string;
}

export interface ChangesetStatus {
  changesets: Changeset[];
  releases: Release[];
}

export interface PackageJson {
  name: string;
  [key: string]: any;
}

/** The name attribute in the package.json, e.g. `@shopify/prettier-plugin-liquid` */
export type PackageName = string;
export type PackageJsonRecord = Record<PackageName, PackageJson>;
