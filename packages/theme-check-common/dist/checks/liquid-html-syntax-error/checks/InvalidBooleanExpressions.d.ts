import { LiquidBooleanExpression, LiquidHtmlNode } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
export declare function detectInvalidBooleanExpressions(node: LiquidBooleanExpression, ancestors: LiquidHtmlNode[]): Problem<SourceCodeType.LiquidHtml> | undefined;
