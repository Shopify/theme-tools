import { Context, SourceCodeType, JSONNode } from '../../types';
import { PropertyNode } from '../../jsonc/types';
export declare function isPropertyNode(node: unknown): node is PropertyNode;
export declare function getAllBlocks(ast: JSONNode, offset: number, ancestorType: string, blocks: PropertyNode, currentPath: string[], context: Context<SourceCodeType.JSON>): Promise<void>;
