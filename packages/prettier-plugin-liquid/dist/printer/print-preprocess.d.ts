import * as AST from '@shopify/liquid-html-parser';
import { LiquidParserOptions, DocumentNode } from '../types';
export declare function preprocess(ast: AST.DocumentNode, options: LiquidParserOptions): DocumentNode;
