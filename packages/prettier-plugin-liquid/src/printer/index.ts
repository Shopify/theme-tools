import { printerLiquidHtml2, printerLiquidHtml3 } from './printer-liquid-html';
import { liquidHtmlAstFormat } from '../parser';

export const printers2 = {
  [liquidHtmlAstFormat]: printerLiquidHtml2,
};

export const printers3 = {
  [liquidHtmlAstFormat]: printerLiquidHtml3,
};
