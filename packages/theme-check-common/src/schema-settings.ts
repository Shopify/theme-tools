/**
 * Returns the LiquidDoc-syntax type (`string`, `product`, `product[]`, ...)
 * of the value a schema setting produces, or undefined when the setting type
 * is not mapped yet.
 */
export function schemaSettingLiquidType(settingType: string): string | undefined {
  switch (settingType) {
    case 'checkbox':
      return 'boolean';
    case 'number':
    case 'range':
      return 'number';
    case 'color_background':
    case 'color_palette':
    case 'html':
    case 'inline_richtext':
    case 'liquid':
    case 'radio':
    case 'richtext':
    case 'select':
    case 'text':
    case 'text_alignment':
    case 'textarea':
    case 'url':
    case 'video_url':
      return 'string';
    case 'article':
    case 'blog':
    case 'collection':
    case 'color':
    case 'color_scheme':
    case 'page':
    case 'product':
    case 'video':
      return settingType;
    case 'font_picker':
      return 'font';
    case 'image_picker':
      return 'image';
    case 'link_list':
      return 'linklist';
    case 'collection_list':
      return 'collection[]';
    case 'product_list':
      return 'product[]';
    default:
      return undefined;
  }
}
