import type { CheckDefinition, SourceCodeType } from '../types';
import { runLiquidCheck } from './test-helper';

export const INVALID_SCHEMA_BLOCK = ['{% schema %}', '{ invalid', '{% endschema %}'].join('\n');

/** Source for a block with the given schema settings and optional LiquidDoc `@param` lines. */
export function blockSource(settings: Record<string, unknown>[], params: string[] = []): string {
  return [
    ...(params.length > 0 ? [liquidDocBlock(params)] : []),
    '{% schema %}',
    JSON.stringify({ settings }),
    '{% endschema %}',
  ].join('\n');
}

/** Source for a schema-less block with only the given LiquidDoc `@param` lines. */
export function liquidDocBlock(params: string[]): string {
  return ['{% doc %}', ...params.map((param) => `  ${param}`), '{% enddoc %}'].join('\n');
}

/**
 * Runs a check on `templates/test.liquid` with `block` as `blocks/card.liquid`.
 * Pass `undefined` to leave the target block missing.
 */
export function runBlockCallCheck(
  check: CheckDefinition<SourceCodeType.LiquidHtml>,
  template: string,
  block: string | undefined,
) {
  return runLiquidCheck(
    check,
    template,
    'templates/test.liquid',
    {},
    block === undefined ? undefined : { 'blocks/card.liquid': block },
  );
}
