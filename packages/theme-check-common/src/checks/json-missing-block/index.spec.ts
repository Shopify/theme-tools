import { describe, expect, it } from 'vitest';
import { SourceCodeType, toBlockSchema, toSectionSchema, toSourceCode } from '../..';
import { check } from '../../test';
import { JSONMissingBlock } from './index';

const appType = 'shopify://apps/example/blocks/widget/00000000-0000-4000-8000-000000000000';
const hostSource = '{% schema %}{"name":"Host","blocks":[]}{% endschema %}';

function theme(nested: boolean, malformedType?: unknown) {
  const blocks = {
    ...(malformedType !== undefined && { malformed: { type: malformedType } }),
    widget: { type: appType },
  };
  return {
    'templates/product.json': JSON.stringify({
      sections: {
        main: nested
          ? { type: 'main', blocks: { host: { type: 'host', blocks } } }
          : { type: 'host', blocks },
      },
      order: ['main'],
    }),
    'sections/main.liquid':
      '{% schema %}{"name":"Main","blocks":[{"type":"@theme"}]}{% endschema %}',
    [nested ? 'blocks/host.liquid' : 'sections/host.liquid']: hostSource,
  };
}

describe('JSONMissingBlock', () => {
  describe.each([false, true])('nested host: %s', (nested) => {
    it.each([
      { label: 'number', type: 123 },
      { label: 'boolean', type: true },
      { label: 'array', type: [] },
      { label: 'object', type: {} },
    ])(
      'continues checking siblings when a block type is a $label',
      async ({ type: malformedType }) => {
        const files = theme(nested, malformedType);
        if (!nested) {
          files['sections/host.liquid'] =
            '{% schema %}{"name":"Host","blocks":[{"type":"text","name":"Text"}]}{% endschema %}';
        }
        // The test helper rethrows check errors, so an exception cannot look like a clean result.
        const offenses = await check(files, [JSONMissingBlock]);
        expect(offenses).toHaveLength(1);
        expect(offenses[0].message).toBe(
          `Block type '${appType}' is not allowed in '${nested ? 'blocks' : 'sections'}/host.liquid'.`,
        );
      },
    );

    it.each(['invalid', 'unavailable', 'valid'] as const)(
      'respects the schema validator result: %s',
      async (validation) => {
        const uri = `file:/${nested ? 'blocks' : 'sections'}/host.liquid`;
        const source = toSourceCode(uri, hostSource);
        if (source?.type !== SourceCodeType.LiquidHtml) throw new Error('Expected Liquid host');
        const validator =
          validation === 'unavailable' ? undefined : async () => validation === 'valid';
        const getBlockSchema = async () => toBlockSchema(uri, source.ast, validator, true);
        const getSectionSchema = async () => toSectionSchema(uri, source.ast, validator, true);
        const schema = await (nested ? getBlockSchema() : getSectionSchema());
        expect(schema.validSchema instanceof Error).toBe(validation !== 'valid');
        const dependencies = nested ? { getBlockSchema } : { getSectionSchema };
        const offenses = await check(theme(nested), [JSONMissingBlock], dependencies);
        expect(offenses).toHaveLength(validation === 'valid' ? 1 : 0);
      },
    );
  });
});
