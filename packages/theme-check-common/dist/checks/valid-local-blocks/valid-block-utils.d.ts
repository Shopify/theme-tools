import { Preset, ThemeBlock, Section, Context, SourceCodeType, LiteralNode } from '../../types';
type BlockNodeWithPath = {
    node: Section.Block | ThemeBlock.Block | Preset.Block;
    path: string[];
};
export declare function getBlocks(validSchema: ThemeBlock.Schema | Section.Schema): {
    staticBlockLocations: BlockNodeWithPath[];
    localBlockLocations: BlockNodeWithPath[];
    themeBlockLocations: BlockNodeWithPath[];
    hasRootLevelThemeBlocks: boolean;
};
export declare function reportWarning(message: string, offset: number, astNode: LiteralNode, context: Context<SourceCodeType.LiquidHtml>): void;
export {};
