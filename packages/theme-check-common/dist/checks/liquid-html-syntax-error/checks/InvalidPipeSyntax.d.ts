import { LiquidVariableOutput, LiquidTag } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
export declare function detectInvalidPipeSyntax(node: LiquidVariableOutput | LiquidTag): Promise<Problem<SourceCodeType.LiquidHtml>[]>;
