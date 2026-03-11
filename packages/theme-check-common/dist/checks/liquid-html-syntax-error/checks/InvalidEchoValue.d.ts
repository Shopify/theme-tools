import { LiquidTag, LiquidVariableOutput } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
export declare function detectInvalidEchoValue(node: LiquidTag | LiquidVariableOutput): Problem<SourceCodeType.LiquidHtml> | undefined;
