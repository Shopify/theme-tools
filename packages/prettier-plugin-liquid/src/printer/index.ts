import { liquidHtmlAstFormat } from '../parser';
import { printerLiquidHtml2, printerLiquidHtml3 } from './printer-liquid-html';

export const printers2 = {
  [liquidHtmlAstFormat]: printerLiquidHtml2,
};

export const printers3 = {
  [liquidHtmlAstFormat]: printerLiquidHtml3,
};
