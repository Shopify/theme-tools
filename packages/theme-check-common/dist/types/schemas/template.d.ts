import { Setting } from './setting';
export declare namespace Template {
    interface Template {
        layout?: string | false;
        wrapper?: string;
        sections: Record<string, Template.Section>;
        order: string[];
    }
    interface Section {
        type: string;
        settings?: Setting.Values;
        disabled?: boolean;
        blocks?: Record<string, Template.Block>;
        block_order?: string[];
    }
    interface Block {
        type: string;
        settings?: Setting.Values;
        disabled?: boolean;
        blocks?: Record<string, Template.Block>;
        block_order?: string[];
        static?: boolean;
    }
    interface SectionGroup {
        type: string;
        name: string;
        sections: Record<string, Template.Section>;
        order: string[];
    }
}
