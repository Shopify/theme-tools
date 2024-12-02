import { Setting } from './setting';

export declare namespace Preset {
  // Preset definitions
  export type Preset =
    | {
        name: string;
        settings?: Setting.Values;
        blocks?: PresetBlockHash;
        block_order?: string[];
      }
    | {
        name: string;
        settings?: Setting.Values;
        blocks?: PresetBlockForArray[];
      }
    | { name: string; settings?: Setting.Values };

  // Reuse the block preset types from ThemeBlock namespace
  export type PresetBlockBase = {
    type: string;
    settings?: Setting.Values;
    static?: boolean;
    blocks?: PresetBlockHash | PresetBlockForArray[];
  };

  export type PresetBlockForHash = PresetBlockBase & {
    block_order?: string[];
  };

  export type PresetBlockForArray = PresetBlockBase & {
    id?: string;
  };

  // Hash format for blocks
  export type PresetBlockHash = {
    [id: string]: PresetBlockForHash;
  };

  /** Base type for presets */
  export type BlockPresetBase = {
    /** Refers to a block type. blocks/{type}.liquid */
    type: string;
    settings?: Setting.Values;
  };

  // prettier-ignore
  export type Block = (
    | PresetBlockForHash
    | PresetBlockForArray
  );
}
