import { LiquidTag } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType, TagEntry } from '../../..';
export declare function detectInvalidLoopArguments(node: LiquidTag, tags?: TagEntry[]): Problem<SourceCodeType.LiquidHtml> | undefined;
