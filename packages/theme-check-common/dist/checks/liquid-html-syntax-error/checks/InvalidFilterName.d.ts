import { LiquidVariableOutput, LiquidTag } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType, FilterEntry } from '../../..';
export declare function detectInvalidFilterName(node: LiquidVariableOutput | LiquidTag, filters: FilterEntry[] | undefined): Promise<Problem<SourceCodeType.LiquidHtml>[]>;
