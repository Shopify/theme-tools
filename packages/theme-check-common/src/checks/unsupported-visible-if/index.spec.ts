import { expect, describe, it } from 'vitest';
import { check } from '../../test';
import { Severity } from '../../types';
import { UnsupportedVisibleIf, UnsupportedVisibleIfSettingsSchema } from './index';
import { VISIBLE_IF_UNSUPPORTED_SETTING_TYPES } from '../valid-visible-if/visible-if-utils';

const toLiquid = (schema: unknown) => `
  {% schema %}
    ${JSON.stringify(schema, undefined, 2)}
  {% endschema %}
`;

const checkRule = (files: Record<string, string>) =>
  check(files, [UnsupportedVisibleIf, UnsupportedVisibleIfSettingsSchema]);

const message = (type: string) =>
  `visible_if is not supported on settings of type '${type}' and will be ignored. The setting is always visible in the theme editor.`;

describe('Module: UnsupportedVisibleIf', () => {
  it.each([...VISIBLE_IF_UNSUPPORTED_SETTING_TYPES])(
    'warns about visible_if on a %s setting in a section',
    async (type) => {
      const offenses = await checkRule({
        'sections/example.liquid': toLiquid({
          name: 'Example',
          settings: [
            { type: 'checkbox', id: 'show', label: 'Show' },
            { type, id: 'picker', label: 'Picker', visible_if: '{{ section.settings.show }}' },
          ],
        }),
      });

      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).toBe(message(type));
      expect(offenses[0].severity).toBe(Severity.WARNING);
    },
  );

  it('warns about visible_if on an unsupported setting in a theme block', async () => {
    const offenses = await checkRule({
      'blocks/example.liquid': toLiquid({
        name: 'Example',
        settings: [
          { type: 'checkbox', id: 'show', label: 'Show' },
          {
            type: 'collection',
            id: 'c',
            label: 'Collection',
            visible_if: '{{ block.settings.show }}',
          },
        ],
      }),
    });

    expect(offenses.map((o) => o.message)).toEqual([message('collection')]);
  });

  it("warns about visible_if on an unsupported setting in a section's local block", async () => {
    const offenses = await checkRule({
      'sections/example.liquid': toLiquid({
        name: 'Example',
        blocks: [
          {
            type: 'featured',
            name: 'Featured',
            settings: [
              { type: 'checkbox', id: 'show', label: 'Show' },
              { type: 'page', id: 'p', label: 'Page', visible_if: '{{ block.settings.show }}' },
            ],
          },
        ],
      }),
    });

    expect(offenses.map((o) => o.message)).toEqual([message('page')]);
  });

  it('highlights the visible_if value', async () => {
    const visibleIf = '{{ section.settings.show }}';
    const files = {
      'sections/example.liquid': toLiquid({
        name: 'Example',
        settings: [{ type: 'product', id: 'p', label: 'Product', visible_if: visibleIf }],
      }),
    };

    const offenses = await checkRule(files);
    const source = files['sections/example.liquid'];

    expect(offenses).toHaveLength(1);
    expect(source.slice(offenses[0].start.index, offenses[0].end.index)).toBe(`"${visibleIf}"`);
  });

  it('does not report visible_if on supported setting types', async () => {
    const offenses = await checkRule({
      'sections/example.liquid': toLiquid({
        name: 'Example',
        settings: [
          { type: 'checkbox', id: 'show', label: 'Show' },
          { type: 'text', id: 't', label: 'Text', visible_if: '{{ section.settings.show }}' },
          {
            type: 'image_picker',
            id: 'i',
            label: 'Image',
            visible_if: '{{ section.settings.show }}',
          },
        ],
      }),
    });

    expect(offenses).toEqual([]);
  });

  it('does not report unsupported setting types without visible_if', async () => {
    const offenses = await checkRule({
      'sections/example.liquid': toLiquid({
        name: 'Example',
        settings: [{ type: 'product', id: 'p', label: 'Product' }],
      }),
    });

    expect(offenses).toEqual([]);
  });

  it('warns about visible_if on unsupported settings in config/settings_schema.json', async () => {
    const offenses = await checkRule({
      'config/settings_schema.json': JSON.stringify([
        {
          name: 'General',
          settings: [
            { type: 'checkbox', id: 'show', label: 'Show' },
            { type: 'text', id: 't', label: 'Text', visible_if: '{{ settings.show }}' },
            { type: 'color_palette', id: 'palette', visible_if: '{{ settings.show }}' },
            { type: 'blog', id: 'b', label: 'Blog', visible_if: '{{ settings.show }}' },
          ],
        },
      ]),
    });

    expect(offenses.map((o) => o.message)).toEqual([message('color_palette'), message('blog')]);
  });
});
