import { LiquidCheckDefinition } from '@shopify/theme-check-common';
import { ParserBlockingScript } from './parser-blocking-script';

export const allChecks: LiquidCheckDefinition[] = [
  ParserBlockingScript,
];

export const recommended = allChecks.filter(
  (check) => check.meta.docs.recommended,
);
