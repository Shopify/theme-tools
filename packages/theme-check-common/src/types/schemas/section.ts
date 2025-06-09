import { Setting } from './setting';
import { Preset } from './preset';

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
    presets?: Preset.Preset[];
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

  export type DefaultBlock = {
    type: string;
    settings?: Record<string, string | number | boolean | string[]>;
  };

  // Default section configuration (kind of like presets)
  export interface Default {
    settings?: Record<string, string | number | boolean | string[]>;
    blocks?: Array<DefaultBlock>;
  }

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
