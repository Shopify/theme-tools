import type { ExecOptions } from 'child_process';

/**
 * Child_process types do not have a good definition for options so we need to
 * do this silly wrapping so typescript can chill out.
 */
export type RunOptions = {
  encoding: string;
} & ExecOptions;

export type FileStatus = {
  status: string;
  filepath: string;
};

export type StageFunction = (arg?: any) => Promise<any> | void;

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

export interface StatusProperty {
  _value: ChangesetStatus;
  value: ChangesetStatus;
}

export interface PackageJson {
  name: string;
  [key: string]: any;
}

export interface PackageJsonMap {
  [key: string]: PackageJson;
}
