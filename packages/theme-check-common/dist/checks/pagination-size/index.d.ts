import { LiquidCheckDefinition, SchemaProp } from '../../types';
declare const schema: {
    minSize: SchemaProp<number>;
    maxSize: SchemaProp<number>;
};
export declare const PaginationSize: LiquidCheckDefinition<typeof schema>;
export {};
