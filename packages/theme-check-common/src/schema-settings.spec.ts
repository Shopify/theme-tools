import { describe, expect, it } from 'vitest';
import { schemaSettingLiquidType } from './schema-settings';

describe('schemaSettingLiquidType', () => {
  it.each([
    ['checkbox', 'boolean'],
    ['number', 'number'],
    ['range', 'number'],
    ['color_background', 'string'],
    ['color_palette', 'string'],
    ['html', 'string'],
    ['inline_richtext', 'string'],
    ['liquid', 'string'],
    ['radio', 'string'],
    ['richtext', 'string'],
    ['select', 'string'],
    ['text', 'string'],
    ['text_alignment', 'string'],
    ['textarea', 'string'],
    ['url', 'string'],
    ['video_url', 'string'],
    ['article', 'article'],
    ['blog', 'blog'],
    ['collection', 'collection'],
    ['color', 'color'],
    ['color_scheme', 'color_scheme'],
    ['font_picker', 'font'],
    ['image_picker', 'image'],
    ['link_list', 'linklist'],
    ['page', 'page'],
    ['product', 'product'],
    ['video', 'video'],
    ['collection_list', 'collection[]'],
    ['product_list', 'product[]'],
  ] as const)('maps %s settings to their Liquid type', (type, expected) => {
    expect(schemaSettingLiquidType(type)).toBe(expected);
  });

  it.each([
    'color_scheme_group',
    'metaobject',
    'metaobject_list',
    'style.layout_panel',
    'style.size_panel',
    'style.spacing_panel',
    'unknown',
  ])('leaves the currently unmapped %s setting type unknown', (type) => {
    expect(schemaSettingLiquidType(type)).toBeUndefined();
  });
});
