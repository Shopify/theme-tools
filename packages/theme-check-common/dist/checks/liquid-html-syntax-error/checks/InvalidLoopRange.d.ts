import { LiquidTag } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
export declare const INVALID_LOOP_RANGE_MESSAGE = "Ranges must be in the format `(<start>..<end>)`. The start and end of the range must be whole numbers or variables.";
export declare function detectInvalidLoopRange(node: LiquidTag): Problem<SourceCodeType.LiquidHtml> | undefined;
