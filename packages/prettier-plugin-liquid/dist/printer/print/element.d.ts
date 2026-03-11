import { doc } from 'prettier';
import { AstPath, LiquidParserOptions, LiquidPrinter, HtmlNode, LiquidPrinterArgs, HtmlRawNode } from '../../types';
export declare function printRawElement(path: AstPath<HtmlRawNode>, options: LiquidParserOptions, print: LiquidPrinter, _args: LiquidPrinterArgs): doc.builders.Group;
export declare function printElement(path: AstPath<HtmlNode>, options: LiquidParserOptions, print: LiquidPrinter, args: LiquidPrinterArgs): any[] | doc.builders.Group;
