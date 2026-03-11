import { Setting } from './setting';
import { Preset } from './preset';
export declare namespace ThemeBlock {
    /** Typed content of {% schema %} after passing validation */
    interface Schema {
        name?: string;
        settings?: Setting.Any[];
        blocks?: Block[];
        presets?: Preset.Preset[];
        class?: string;
        tag?: string | null;
    }
    type ThemeBlock = {
        type: '@theme';
    };
    type AppBlock = {
        type: '@app';
    };
    type SpecificThemeBlock = {
        /** blocks/{type}.liquid */
        type: string;
    };
    type Block = (ThemeBlock | AppBlock | SpecificThemeBlock);
}
