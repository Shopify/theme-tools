import { Setting } from './setting';

export declare namespace Section {
  /** {% schema %} */
  export interface Schema {
    name?: string;
    tag?: 'article' | 'aside' | 'div' | 'footer' | 'header' | 'section';
    class?: string;
    limit?: number;
    settings?: Setting.Any[];
    max_blocks?: number;
    blocks?: Block[];
    presets?: Preset[];
    default?: Default;
    locales?: Record<string, Record<string, string>>;
    enabled_on?: SectionToggle;
    disabled_on?: SectionToggle;
  }

  // Block definitions
  export type Block = ThemeBlock | AppBlock | SpecificThemeBlock | LocalBlock;

  export type ThemeBlock = {
    type: '@theme';
  };

  export type AppBlock = {
    type: '@app';
  };

  export type SpecificThemeBlock = {
    type: string;
    limit?: number;
    template?: string;
  };

  export type LocalBlock = {
    type: string;
    name: string;
    settings?: Setting.Any[];
  };

  // Preset definitions
  export interface Preset {
    name: string;
    settings?: Record<string, string | number | boolean | string[]>;
    blocks?: PresetBlocks;
  }

  // Default section configuration (kind of like presets)
  export interface Default {
    settings?: Record<string, string | number | boolean | string[]>;
    blocks?: Array<{
      type: string;
      settings?: Record<string, string | number | boolean | string[]>;
    }>;
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

  // Section toggle interface
  export interface SectionToggle {
    templates?: TemplateType[];
    groups?: string[];
  }

  // Template types for section toggle
  export type TemplateType =
    | '*'
    | '404'
    | 'article'
    | 'blog'
    | 'captcha'
    | 'cart'
    | 'collection'
    | 'customers/account'
    | 'customers/activate_account'
    | 'customers/addresses'
    | 'customers/login'
    | 'customers/order'
    | 'customers/register'
    | 'customers/reset_password'
    | 'gift_card'
    | 'index'
    | 'list-collections'
    | 'metaobject'
    | 'page'
    | 'password'
    | 'policy'
    | 'product'
    | 'search';
}
