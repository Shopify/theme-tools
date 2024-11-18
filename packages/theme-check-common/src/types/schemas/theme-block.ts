import { Setting } from './setting';

export declare namespace ThemeBlock {
  /** Typed content of {% schema %} after passing validation */
  export interface Schema {
    name?: string;
    settings?: Setting.Any[];
    blocks?: Block[];
    presets?: Preset[];
    class?: string;
    tag?: string | null;
  }

  export type ThemeBlock = {
    type: '@theme';
  };

  export type AppBlock = {
    type: '@app';
  };

  export type SpecificThemeBlock = {
    /** blocks/{type}.liquid */
    type: string;
  };

  // prettier-ignore
  export type Block = (
    | ThemeBlock
    | AppBlock
    | SpecificThemeBlock
  );

  // The preset type that uses the above
  export interface Preset {
    name: string;
    settings?: Setting.Values;
    blocks?: BlockPresets;
  }

  // Union type that represents either format
  export type BlockPresets = BlockPresetArrayElement[] | BlockPresetHash;

  // Hash format for blocks
  export type BlockPresetHash = {
    [id: string]: BlockPresetBase & {
      blocks?: BlockPresets;
    };
  };

  // Array element format for blocks
  export type BlockPresetArrayElement = (BlockPresetBase | BlockPresetStatic) & {
    blocks?: BlockPresets; // Recursive
  };

  /** Base type for presets */
  export type BlockPresetBase = {
    /** Refers to a block type. blocks/{type}.liquid */
    type: string;
    settings?: Setting.Values;
  };

  /** Static blocks */
  export type BlockPresetStatic = BlockPresetBase & {
    static: true;
    id: string;
  };
}
