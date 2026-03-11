import { JSONNode, Preset, Section, SourceCodeType, ThemeBlock, Context, StaticBlockDef } from '../types';
export type BlockDefNodeWithPath = {
    node: Section.Block | ThemeBlock.Block;
    path: string[];
};
export type PresetBlockNodeWithPath = {
    node: Preset.Block;
    path: string[];
};
export declare function getBlocks(validSchema: ThemeBlock.Schema | Section.Schema): {
    rootLevelThemeBlocks: BlockDefNodeWithPath[];
    rootLevelLocalBlocks: BlockDefNodeWithPath[];
    presetLevelBlocks: {
        [key: number]: PresetBlockNodeWithPath[];
    };
    defaultLevelBlocks: BlockDefNodeWithPath[];
};
export declare function isInvalidPresetBlock(blockId: string, blockNode: Preset.Block, rootLevelThemeBlocks: BlockDefNodeWithPath[], staticBlockDefs: StaticBlockDef[]): boolean;
export declare function isInvalidDefaultBlock(blockNode: Section.Block | ThemeBlock.Block, rootLevelThemeBlocks: BlockDefNodeWithPath[]): boolean;
export declare function validateNestedBlocks(context: Context<SourceCodeType.LiquidHtml>, parentNode: Preset.PresetBlockForHash | Preset.PresetBlockForArray, nestedBlocks: Preset.PresetBlockHash | Preset.PresetBlockForArray[], currentPath: string[], offset: number, ast: JSONNode): Promise<void>;
export declare function reportWarning(message: string, offset: number, astNode: JSONNode, context: Context<SourceCodeType.LiquidHtml>): void;
export declare function validateBlockFileExistence(blockType: string, context: Context<SourceCodeType.LiquidHtml>): Promise<boolean>;
