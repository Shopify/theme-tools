import { Setting } from './setting';

export declare namespace Preset {
  // Preset definitions
  export interface Preset {
    name: string;
    settings?: Record<string, string | number | boolean | string[]>;
    blocks?: PresetBlocks;
  }

  // Reuse the block preset types from ThemeBlock namespace
  export type PresetBlocks = BlockPresetArrayElement[] | BlockPresetHash;

  export type BlockPresetHash = Record<string, BlockPresetBase>;
  export type BlockPresetArrayElement = BlockPresetBase | BlockPresetStatic;

  export type BlockPresetStatic = BlockPresetBase & {
    static: true;
    id: string;
  };

  export type BlockPresetBase = {
    type: string;
    settings?: Setting.Values;
    blocks?: PresetBlocks;
  };
}
