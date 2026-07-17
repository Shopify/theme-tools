import { describe, expect, it } from 'vitest';
import {
  JavascriptOncePerFile,
  JavascriptTagInWrongFile,
  SchemaOncePerFile,
  SchemaSectionOrBlockOnly,
  StylesheetOncePerFile,
  StylesheetTagInWrongFile,
} from './index';
import { runLiquidCheck } from '../../test';

const SCHEMA_TAG = '{% schema %}{% endschema %}';
const JAVASCRIPT_TAG = '{% javascript %}{% endjavascript %}';
const STYLESHEET_TAG = '{% stylesheet %}{% endstylesheet %}';

describe('raw tag checks', () => {
  describe('schema', () => {
    it.each(['sections/test.liquid', 'blocks/test.liquid'])(
      'allows schema tags in %s',
      async (path) => {
        const offenses = await runLiquidCheck(SchemaSectionOrBlockOnly, SCHEMA_TAG, path);

        expect(offenses).toEqual([]);
      },
    );

    it.each(['templates/index.liquid', 'snippets/test.liquid'])(
      'reports schema tags in %s',
      async (path) => {
        const offenses = await runLiquidCheck(SchemaSectionOrBlockOnly, SCHEMA_TAG, path);

        expect(offenses).toHaveLength(1);
        expect(offenses[0]).toMatchObject({
          check: 'SchemaSectionOrBlockOnly',
          message: '{% schema %} is only valid in section or block files.',
        });
      },
    );

    it('reports second and subsequent schema tags in a file', async () => {
      const source = [SCHEMA_TAG, SCHEMA_TAG, SCHEMA_TAG].join('\n');

      const offenses = await runLiquidCheck(SchemaOncePerFile, source, 'sections/test.liquid');

      expect(offenses).toHaveLength(2);
      expect(offenses).toEqual([
        expect.objectContaining({
          check: 'SchemaOncePerFile',
          message: '{% schema %} can only appear once per file.',
        }),
        expect.objectContaining({
          check: 'SchemaOncePerFile',
          message: '{% schema %} can only appear once per file.',
        }),
      ]);
    });
  });

  describe('javascript', () => {
    it.each(['sections/test.liquid', 'blocks/test.liquid', 'snippets/test.liquid'])(
      'allows javascript tags in %s',
      async (path) => {
        const offenses = await runLiquidCheck(JavascriptTagInWrongFile, JAVASCRIPT_TAG, path);

        expect(offenses).toEqual([]);
      },
    );

    it.each(['templates/index.liquid'])('reports javascript tags in %s', async (path) => {
      const offenses = await runLiquidCheck(JavascriptTagInWrongFile, JAVASCRIPT_TAG, path);

      expect(offenses).toHaveLength(1);
      expect(offenses[0]).toMatchObject({
        check: 'JavascriptTagInWrongFile',
        message: '{% javascript %} is only valid in section, block, or snippet files.',
      });
    });

    it('reports second and subsequent javascript tags in a file', async () => {
      const source = [JAVASCRIPT_TAG, JAVASCRIPT_TAG, JAVASCRIPT_TAG].join('\n');

      const offenses = await runLiquidCheck(JavascriptOncePerFile, source, 'sections/test.liquid');

      expect(offenses).toHaveLength(2);
      expect(offenses).toEqual([
        expect.objectContaining({
          check: 'JavascriptOncePerFile',
          message: '{% javascript %} can only appear once per file.',
        }),
        expect.objectContaining({
          check: 'JavascriptOncePerFile',
          message: '{% javascript %} can only appear once per file.',
        }),
      ]);
    });
  });

  describe('stylesheet', () => {
    it.each(['sections/test.liquid', 'blocks/test.liquid', 'snippets/test.liquid'])(
      'allows stylesheet tags in %s',
      async (path) => {
        const offenses = await runLiquidCheck(StylesheetTagInWrongFile, STYLESHEET_TAG, path);

        expect(offenses).toEqual([]);
      },
    );

    it.each(['templates/index.liquid'])('reports stylesheet tags in %s', async (path) => {
      const offenses = await runLiquidCheck(StylesheetTagInWrongFile, STYLESHEET_TAG, path);

      expect(offenses).toHaveLength(1);
      expect(offenses[0]).toMatchObject({
        check: 'StylesheetTagInWrongFile',
        message: '{% stylesheet %} is only valid in section, block, or snippet files.',
      });
    });

    it('reports second and subsequent stylesheet tags in a file', async () => {
      const source = [STYLESHEET_TAG, STYLESHEET_TAG, STYLESHEET_TAG].join('\n');

      const offenses = await runLiquidCheck(StylesheetOncePerFile, source, 'sections/test.liquid');

      expect(offenses).toHaveLength(2);
      expect(offenses).toEqual([
        expect.objectContaining({
          check: 'StylesheetOncePerFile',
          message: '{% stylesheet %} can only appear once per file.',
        }),
        expect.objectContaining({
          check: 'StylesheetOncePerFile',
          message: '{% stylesheet %} can only appear once per file.',
        }),
      ]);
    });
  });
});
