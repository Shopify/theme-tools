import { Setting } from './setting';
import { Preset } from './preset';

export declare namespace ThemeBlock {
  /** Typed content of {% schema %} after passing validation */
  export interface Schema {
    name?: string;
    settings?: Setting.Any[];
    blocks?: Block[];
    presets?: Preset.Preset[];
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
}
