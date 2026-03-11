import { DocDefinition, LiquidDocParameter } from '@shopify/theme-check-common';
export declare function formatLiquidDocParameter({ name, type, description, required }: LiquidDocParameter, heading?: boolean): string;
export declare function formatLiquidDocTagHandle(label: string, description: string, example: string): string;
export declare const SUPPORTED_LIQUID_DOC_TAG_HANDLES: {
    param: {
        description: string;
        example: string;
        template: string;
    };
    example: {
        description: string;
        example: string;
        template: string;
    };
    description: {
        description: string;
        example: string;
        template: string;
    };
};
export declare function getParameterCompletionTemplate(name: string, type: string | null): string;
export declare function formatLiquidDocContentMarkdown(name: string, docDefinition?: DocDefinition): string;
