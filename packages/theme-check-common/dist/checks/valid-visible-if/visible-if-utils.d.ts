import { type LiquidVariableLookup } from '@shopify/liquid-html-parser';
import { Context, SourceCodeType } from '../..';
export type Vars = {
    [key: string]: Vars | true;
};
export declare const variableExpressionMatcher: RegExp;
export declare const adjustedPrefix = "{% if ";
export declare const adjustedSuffix = " %}{% endif %}";
export declare const offsetAdjust: number;
export declare function getVariableLookupsInExpression(expression: string): LiquidVariableLookup[] | {
    warning: string;
} | null;
export declare function validateLookup(lookup: LiquidVariableLookup, vars: Vars): string | null;
export declare function getGlobalSettings(context: Context<SourceCodeType>): Promise<string[]>;
