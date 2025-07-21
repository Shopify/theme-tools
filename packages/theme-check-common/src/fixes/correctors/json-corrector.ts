import { set as lodashSet, unset as lodashUnset } from 'lodash';
import { Fix } from '../../types';
import { BaseCorrector } from './base-corrector';

type Operation = AddOperation | RemoveOperation;

type AddOperation = {
  type: 'add';
  path: string;
  value: any;
};

type RemoveOperation = {
  type: 'remove';
  path: string;
};

// This function mutates json. So use it in a reducer and consider it a
// fire and forget.
function applyPatch(json: any, operation: Operation) {
  switch (operation.type) {
    case 'add': {
      return lodashSet(json, operation.path, operation.value);
    }

    case 'remove': {
      lodashUnset(json, operation.path);
      return json;
    }
  }
}

/**
 * The JSONCorrector collects patches and then creates a Fix object
 * that represents the application of all the collected patches on the
 * source document.
 *
 * Fixes are assumed to not be overlapping.
 */
export class JSONCorrector implements BaseCorrector {
  private readonly patches: Operation[] = [];

  constructor(public source: string) {}

  /**
   * corrector.fix is the data representation of all the changes to source.
   */
  public get fix(): Fix {
    if (this.patches.length === 0) return [];

    const json = this.patches.reduce(applyPatch, JSON.parse(this.source));

    return {
      startIndex: 0,
      endIndex: this.source.length,
      insert: JSON.stringify(json, null, 2),
    };
  }

  /**
   * Add value at dot delited JSON path
   *
   * @example
   * corrector.add('missing.key', 'TO DO')
   */
  add(path: string, value: any): void {
    this.patches.push({
      type: 'add',
      path,
      value,
    });
  }

  /**
   * Replace a value at dot delited JSON path.
   *
   * @example
   * corrector.replace('missing.key', 'TO DO')
   */
  replace(path: string, value: any): void {
    this.patches.push(
      {
        type: 'remove',
        path,
      },
      {
        type: 'add',
        path,
        value,
      },
    );
  }

  /**
   * Remove key from JSON object
   *
   * @example
   * corrector.remove('unneeded.key')
   */
  remove(path: string): void {
    this.patches.push({
      type: 'remove',
      path,
    });
  }
}
