import { LiquidTag } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
export declare function detectMultipleAssignValues(node: LiquidTag): Problem<SourceCodeType.LiquidHtml> | undefined;
