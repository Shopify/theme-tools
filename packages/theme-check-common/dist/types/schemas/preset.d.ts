import { Setting } from './setting';
export declare namespace Preset {
    type Preset = {
        name: string;
        settings?: Setting.Values;
        blocks?: PresetBlockHash;
        block_order?: string[];
    } | {
        name: string;
        settings?: Setting.Values;
        blocks?: PresetBlockForArray[];
    } | {
        name: string;
        settings?: Setting.Values;
    };
    type PresetBlockBase = {
        type: string;
        settings?: Setting.Values;
        static?: boolean;
        blocks?: PresetBlockHash | PresetBlockForArray[];
    };
    type PresetBlockForHash = PresetBlockBase & {
        block_order?: string[];
    };
    type PresetBlockForArray = PresetBlockBase & {
        id?: string;
    };
    type PresetBlockHash = {
        [id: string]: PresetBlockForHash;
    };
    /** Base type for presets */
    type BlockPresetBase = {
        /** Refers to a block type. blocks/{type}.liquid */
        type: string;
        settings?: Setting.Values;
    };
    type Block = (PresetBlockForHash | PresetBlockForArray);
}
