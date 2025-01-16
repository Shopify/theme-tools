import { Setting } from './setting';

export namespace Template {
  export interface Template {
    layout?: string | false;
    wrapper?: string;
    sections: Record<string, Template.Section>;
    order: string[];
  }

  export interface Section {
    type: string;
    settings?: Setting.Values;
    disabled?: boolean;
    blocks?: Record<string, Template.Block>;
    block_order?: string[];
  }

  export interface Block {
    type: string;
    settings?: Setting.Values;
    disabled?: boolean;
    blocks?: Record<string, Template.Block>;
    block_order?: string[];
    static?: boolean;
  }

  export interface SectionGroup {
    type: string;
    name: string;
    sections: Record<string, Template.Section>;
    order: string[];
  }
}
