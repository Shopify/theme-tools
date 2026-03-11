import { LiquidBranch, LiquidTag } from '@shopify/liquid-html-parser';
import { SourceCodeType, Problem } from '../../..';
export declare function detectInvalidConditionalNode(node: LiquidBranch | LiquidTag): Problem<SourceCodeType.LiquidHtml> | undefined;
