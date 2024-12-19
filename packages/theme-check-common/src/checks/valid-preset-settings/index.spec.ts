import { describe, expect, it } from 'vitest';
import { ValidPresetSettings } from '.';
import { check } from '../../test/test-helper';
import { MockTheme } from '../../test/MockTheme';

describe('ValidPresetSettings', () => {
  it('should report invalid keys in a blocks preset setting', async () => {
    const theme: MockTheme = {
      'blocks/price.liquid': `
        {% schema %}
        {
          "name": "t:names.product_price",
          "settings": [
            {
              "type": "product",
              "id": "product",
              "label": "t:settings.product"
            },
            {
              "type": "collection",
              "id": "collection",
              "label": "t:settings.collection"
            }
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": { 
                "product": "{{ context.product }}",
                "undefined_setting": "some value"
              }
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      'Preset setting "undefined_setting" does not exist in settings',
    );
  });

  it('should report invalid keys in a blocks nested block preset setting', async () => {
    const theme: MockTheme = {
      'blocks/block_1.liquid': `
        {% schema %}
        {
          "name": "t:names.block_1",
        "settings": [
          {
            "type": "text",
            "id": "block_1_setting_key",
            "label": "t:settings.block_1"
          }
        ]
      }
      {% endschema %}
    `,
      'blocks/price.liquid': `
        {% schema %}
        {
          "name": "t:names.product_price",
          "settings": [
            {
              "type": "product",
              "id": "product",
              "label": "t:settings.product"
            },
            {
              "type": "collection",
              "id": "collection",
              "label": "t:settings.collection"
            }
          ],
          "blocks": [
            {
              "type": "block_1",
              "name": "t:names.block_1"
            }
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": {
                "product": "{{ context.product }}",
                "collection": "{{ context.collection }}"
              },
              "blocks": [
                {
                  "block_1": {
                    "type": "block_1",
                    "settings": {
                      "block_1_setting_key": "correct setting key",
                      "undefined_setting": "incorrect setting key"
                    }
                  }
                }
              ]
            },
            {
              "name": "t:names.product_price_2",
              "settings": {
                "product": "{{ context.product }}",
                "collection": "{{ context.collection }}"
              }
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Preset block setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should not report when all preset settings in the block are valid', async () => {
    const theme: MockTheme = {
      'blocks/block_1.liquid': `
        {% schema %}
        {
          "name": "t:names.block_1",
          "settings": [
            {
              "type": "text",
              "id": "block_1_setting_key",
              "label": "t:settings.block_1"
            }
          ]
        }
        {% endschema %}
      `,
      'blocks/price.liquid': `
        {% schema %}
        {
          "name": "t:names.product_price",
          "settings": [
            {
              "type": "product",
              "id": "product",
              "label": "t:settings.product"
            },
            {
              "type": "text",
              "id": "section_setting",
              "label": "t:settings.section"
            }
          ],
          "blocks": [
            {
              "type": "block_1",
              "name": "t:names.block_1"
            }
          ],
          "presets": [
            {
              "name": "t:names.product_price",
              "settings": { 
                "product": "{{ context.product }}",
                "section_setting": "some value"
              },
              "blocks": [
                {
                  "block_1": {
                    "type": "block_1",
                    "settings": {
                      "block_1_setting_key": "correct setting key"
                    }
                  }
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetSettings]);
    expect(offenses).to.have.length(0);
  });

  it('should report invalid keys in a sections preset setting', async () => {
    const theme: MockTheme = {
      'sections/header-announcements.liquid': `
        {% schema %}
        {
          "name": "Announcement bar",
          "tag": "aside",
          "blocks": [
            {
              "type": "announcement"
            }
          ],
          "enabled_on": {
            "groups": [
              "header"
            ]
          },
          "settings": [
            {
              "type": "select",
              "id": "show_as",
              "label": "Type",
              "options": [
                {
                  "value": "carousel",
                  "label": "Carousel"
                },
                {
                  "value": "list",
                  "label": "List"
                },
                {
                  "value": "scroll",
                  "label": "Scroll"
                }
              ]
            },
            {
              "type": "checkbox",
              "id": "auto_rotate",
              "label": "Auto rotate",
              "default": true,
              "available_if": "{{ section.settings.show_as == 'carousel' }}"
            },
            {
              "type": "select",
              "id": "align_items",
              "label": "Alignment",
              "options": [
                {
                  "value": "start",
                  "label": "Start"
                },
                {
                  "value": "center",
                  "label": "Center"
                },
                {
                  "value": "end",
                  "label": "End"
                }
              ],
              "default": "center",
              "available_if": "{{ section.settings.show_as == 'list' }}"
            },
            {
              "type": "range",
              "id": "gap",
              "label": "Gap",
              "min": 0,
              "max": 100,
              "unit": "px",
              "default": 16,
              "available_if": "{{ section.settings.show_as == 'list' }}"
            },
            {
              "type": "range",
              "id": "speed",
              "label": "Speed",
              "min": 0,
              "max": 5,
              "default": 5,
              "unit": "sec",
              "available_if": "{{ section.settings.show_as == 'scroll' }}"
            },
            {
              "type": "color_scheme",
              "id": "color_scheme",
              "default": "scheme-4",
              "label": "Color Scheme"
            },
            {
              "type": "header",
              "content": "Padding"
            },
            {
              "type": "range",
              "id": "padding-block-start",
              "label": "Top",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 16
            },
            {
              "type": "range",
              "id": "padding-block-end",
              "label": "Bottom",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 16
            },
            {
              "type": "range",
              "id": "padding-inline-start",
              "label": "Left",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 2
            },
            {
              "type": "range",
              "id": "padding-inline-end",
              "label": "Right",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 2
            },
            {
              "type": "header",
              "content": "Margin"
            },
            {
              "type": "range",
              "id": "margin-block-start",
              "label": "Top",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            },
            {
              "type": "range",
              "id": "margin-block-end",
              "label": "Bottom",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            },
            {
              "type": "range",
              "id": "margin-inline-start",
              "label": "Left",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            },
            {
              "type": "range",
              "id": "margin-inline-end",
              "label": "Right",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            }
          ],
          "presets": [
            {
              "name": "Announcement bar",
              "settings": {
                "undefined_setting": "list"
              }
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Preset setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should report invalid keys in a sections nested block preset setting', async () => {
    const theme: MockTheme = {
      'blocks/announcement.liquid': `
        {% schema %}
        {
          "name": "Announcement",
          "settings": [
            {
              "type": "text",
              "id": "text",
              "label": "Text"
            }
          ]
        }
        {% endschema %}
      `,
      'sections/header-announcements.liquid': `
        {% schema %}
        {
          "name": "Announcement bar",
          "tag": "aside",
          "blocks": [
            {
              "type": "announcement"
            }
          ],
          "enabled_on": {
            "groups": [
              "header"
            ]
          },
          "settings": [
            {
              "type": "select",
              "id": "show_as",
              "label": "Type",
              "options": [
                {
                  "value": "carousel",
                  "label": "Carousel"
                },
                {
                  "value": "list",
                  "label": "List"
                },
                {
                  "value": "scroll",
                  "label": "Scroll"
                }
              ]
            },
            {
              "type": "checkbox",
              "id": "auto_rotate",
              "label": "Auto rotate",
              "default": true,
              "available_if": "{{ section.settings.show_as == 'carousel' }}"
            },
            {
              "type": "select",
              "id": "align_items",
              "label": "Alignment",
              "options": [
                {
                  "value": "start",
                  "label": "Start"
                },
                {
                  "value": "center",
                  "label": "Center"
                },
                {
                  "value": "end",
                  "label": "End"
                }
              ],
              "default": "center",
              "available_if": "{{ section.settings.show_as == 'list' }}"
            },
            {
              "type": "range",
              "id": "gap",
              "label": "Gap",
              "min": 0,
              "max": 100,
              "unit": "px",
              "default": 16,
              "available_if": "{{ section.settings.show_as == 'list' }}"
            },
            {
              "type": "range",
              "id": "speed",
              "label": "Speed",
              "min": 0,
              "max": 5,
              "default": 5,
              "unit": "sec",
              "available_if": "{{ section.settings.show_as == 'scroll' }}"
            },
            {
              "type": "color_scheme",
              "id": "color_scheme",
              "default": "scheme-4",
              "label": "Color Scheme"
            },
            {
              "type": "header",
              "content": "Padding"
            },
            {
              "type": "range",
              "id": "padding-block-start",
              "label": "Top",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 16
            },
            {
              "type": "range",
              "id": "padding-block-end",
              "label": "Bottom",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 16
            },
            {
              "type": "range",
              "id": "padding-inline-start",
              "label": "Left",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 2
            },
            {
              "type": "range",
              "id": "padding-inline-end",
              "label": "Right",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 2
            },
            {
              "type": "header",
              "content": "Margin"
            },
            {
              "type": "range",
              "id": "margin-block-start",
              "label": "Top",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            },
            {
              "type": "range",
              "id": "margin-block-end",
              "label": "Bottom",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            },
            {
              "type": "range",
              "id": "margin-inline-start",
              "label": "Left",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            },
            {
              "type": "range",
              "id": "margin-inline-end",
              "label": "Right",
              "min": 0,
              "max": 100,
              "step": 1,
              "unit": "px",
              "default": 0
            }
          ],
          "presets": [
            {
              "name": "Announcement bar",
              "blocks": [
                {
                  "announcement": {
                    "type": "announcement",
                    "settings": {
                      "undefined_setting": "list"
                    }
                  }
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Preset block setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should not report when all preset settings in the section are valid', async () => {
    const theme: MockTheme = {
      'blocks/group.liquid': `
        {% schema %}
{
  "name": "Group",
  "tag": null,
  "blocks": [{ "type": "@theme" }, { "type": "@app" }, { "type": "_divider" }],
  "settings": [
    {
      "type": "header",
      "content": "Layout"
    },
    {
      "type": "select",
      "id": "layout_style",
      "label": "Type",
      "options": [
        {
          "value": "flex",
          "label": "Stack"
        },
        {
          "value": "grid",
          "label": "Grid"
        }
      ],
      "default": "flex"
    },
    {
      "type": "select",
      "id": "content_direction",
      "label": "Direction",
      "options": [
        { "value": "row", "label": "Horizontal" },
        { "value": "column", "label": "Vertical" }
      ],
      "default": "column",
      "available_if": "{{ block.settings.layout_style == 'flex' }}"
    },
    {
      "type": "range",
      "id": "number_of_columns",
      "label": "t:settings.number_of_columns",
      "min": 1,
      "max": 8,
      "step": 1,
      "default": 4,
      "available_if": "{{ block.settings.layout_style == 'grid' }}"
    },
    {
      "type": "range",
      "id": "gap",
      "label": "Gap",
      "min": 0,
      "max": 100,
      "step": 4,
      "unit": "px",
      "default": 12
    },
    {
      "type": "select",
      "id": "horizontal_alignment",
      "label": "Horizontal alignment",
      "options": [
        { "value": "flex-start", "label": "Start" },
        { "value": "center", "label": "Center" },
        { "value": "flex-end", "label": "End" }
      ],
      "default": "flex-start",
      "available_if": "{{ block.settings.content_direction == 'row' }}"
    },
    {
      "type": "select",
      "id": "vertical_alignment",
      "label": "Vertical alignment",
      "options": [
        { "value": "flex-start", "label": "Start" },
        { "value": "center", "label": "Center" },
        { "value": "flex-end", "label": "End" }
      ],
      "default": "center",
      "available_if": "{{ block.settings.content_direction == 'row' }}"
    },
    {
      "type": "select",
      "id": "horizontal_alignment_flex_direction_column",
      "label": "Horizontal alignment",
      "options": [
        { "value": "flex-start", "label": "Start" },
        { "value": "center", "label": "Center" },
        { "value": "flex-end", "label": "End" }
      ],
      "default": "flex-start",
      "available_if": "{{ block.settings.content_direction == 'column' }}"
    },
    {
      "type": "select",
      "id": "vertical_alignment_flex_direction_column",
      "label": "Vertical alignment",
      "options": [
        { "value": "flex-start", "label": "Start" },
        { "value": "center", "label": "Center" },
        { "value": "flex-end", "label": "End" }
      ],
      "default": "center",
      "available_if": "{{ block.settings.content_direction == 'column' }}"
    },
    {
      "type": "select",
      "id": "width",
      "label": "Width",
      "options": [
        {
          "value": "fit-content",
          "label": "t:options.fit_content"
        },
        {
          "value": "fill",
          "label": "Fill"
        },
        {
          "value": "custom",
          "label": "t:options.custom"
        }
      ],
      "default": "fill"
    },
    {
      "type": "range",
      "id": "custom_width",
      "label": "t:settings.width",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "%",
      "default": 100,
      "available_if": "{{ block.settings.width == 'custom' }}"
    },
    {
      "type": "checkbox",
      "id": "enable_sticky_content",
      "label": "t:settings.enable_sticky_content",
      "default": false
    },
    {
      "type": "header",
      "content": "t:content.colors"
    },
    {
      "type": "checkbox",
      "id": "inherit_color_scheme",
      "label": "t:settings.inherit_color_scheme",
      "default": true
    },
    {
      "type": "color_scheme",
      "id": "color_scheme",
      "label": "t:settings.color_scheme",
      "default": "scheme-1",
      "available_if": "{{ block.settings.inherit_color_scheme == false }}"
    },
    {
      "type": "header",
      "content": "t:content.background"
    },
    {
      "type": "video",
      "id": "video",
      "label": "t:settings.video"
    },
    {
      "type": "checkbox",
      "id": "video_loop",
      "label": "t:settings.video_loop",
      "default": true,
      "available_if": "{{ block.settings.video }}"
    },
    {
      "type": "select",
      "id": "video_position",
      "label": "t:settings.video_position",
      "options": [
        {
          "value": "cover",
          "label": "t:options.cover"
        },
        {
          "value": "contain",
          "label": "t:options.contain"
        }
      ],
      "default": "cover",
      "available_if": "{{ block.settings.video }}"
    },
    {
      "type": "range",
      "id": "background_video_opacity",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "%",
      "label": "t:settings.overlay_opacity",
      "default": 100,
      "available_if": "{{ block.settings.video }}"
    },
    {
      "type": "image_picker",
      "id": "background_image",
      "label": "t:settings.image"
    },
    {
      "type": "select",
      "id": "background_image_position",
      "label": "t:settings.image_position",
      "options": [
        {
          "value": "cover",
          "label": "t:options.cover"
        },
        {
          "value": "fit",
          "label": "t:options.fit"
        }
      ],
      "default": "cover",
      "available_if": "{{ block.settings.background_image }}"
    },
    {
      "type": "range",
      "id": "background_image_opacity",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "%",
      "label": "t:settings.image_opacity",
      "default": 100,
      "available_if": "{{ block.settings.background_image }}"
    },
    {
      "type": "header",
      "content": "t:content.borders"
    },
    {
      "type": "select",
      "id": "border",
      "label": "t:settings.borders",
      "options": [
        {
          "value": "none",
          "label": "t:options.none"
        },
        {
          "value": "solid",
          "label": "t:options.solid"
        },
        {
          "value": "dashed",
          "label": "t:options.dashed"
        }
      ],
      "default": "none"
    },
    {
      "type": "range",
      "id": "border_width",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "label": "t:settings.width",
      "default": 1,
      "available_if": "{{ block.settings.border != 'none' }}"
    },
    {
      "type": "range",
      "id": "border_opacity",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "%",
      "label": "t:settings.opacity",
      "default": 100,
      "available_if": "{{ block.settings.border != 'none' }}"
    },
    {
      "type": "range",
      "id": "border_radius",
      "label": "t:settings.border_radius",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "header",
      "content": "Padding"
    },
    {
      "type": "range",
      "id": "padding-block-start",
      "label": "Top",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "range",
      "id": "padding-block-end",
      "label": "Bottom",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "range",
      "id": "padding-inline-start",
      "label": "Left",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    },
    {
      "type": "range",
      "id": "padding-inline-end",
      "label": "Right",
      "min": 0,
      "max": 100,
      "step": 1,
      "unit": "px",
      "default": 0
    }
  ],
  "presets": [
    {
      "name": "Group"
    }
  ]
}
{% endschema %}
      `,
      'blocks/slide.liquid': `
        {% schema %}
        {
          "name": "Slide",
          "settings": [
            {
              "type": "text",
              "id": "text",
              "label": "Text"
            }
          ]
        }
        {% endschema %}
      `,
      'sections/slideshow.liquid': `
        {% schema %}
        {
          "name": "t:names.slideshow",
          "blocks": [
            {
              "type": "slide"
            }
          ],
          "settings": [
            {
              "type": "select",
              "id": "slide_height",
              "label": "t:settings.slide_height",
              "default": "medium",
              "options": [
                { "value": "adapt_image", "label": "t:options.adapt_to_image" },
                { "value": "small", "label": "t:options.small" },
                { "value": "medium", "label": "t:options.medium" },
                { "value": "large", "label": "t:options.large" }
              ]
            },
            {
              "type": "select",
              "id": "transition_style",
              "label": "t:settings.transition",
              "default": "horizontal",
              "options": [
                { "value": "horizontal", "label": "t:options.horizontal" },
                { "value": "vertical", "label": "t:options.vertical" }
              ]
            }
          ],
          "presets": [
            {
              "name": "t:names.slideshow",
              "blocks": [
                {
                  "type": "slide",
                  "blocks": [
                    {
                      "type": "group",
                      "settings": {
                        "layout_style": "flex",
                        "width": "custom",
                        "custom_width": 50,
                        "content_direction": "column",
                        "padding-inline-start": 48,
                        "padding-inline-end": 48,
                        "padding-block-start": 48,
                        "padding-block-end": 48,
                        "vertical_alignment_flex_direction_column": "flex-start",
                        "background_image_position": "cover",
                        "background_image_opacity": 100,
                        "border": "none",
                        "border_width": 1,
                        "border_opacity": 100
                      },
                      "blocks": [
                        {
                          "type": "text",
                          "settings": {
                            "text": "<h2>Heading</h2>"
                          }
                        },
                        {
                          "type": "text"
                        },
                        {
                          "type": "button"
                        }
                      ]
                    }
                  ]
                },
                {
                  "type": "slide",
                  "blocks": [
                    {
                      "type": "group",
                      "settings": {
                        "layout_style": "flex",
                        "width": "custom",
                        "custom_width": 50,
                        "content_direction": "column",
                        "padding-inline-start": 48,
                        "padding-inline-end": 48,
                        "padding-block-start": 48,
                        "padding-block-end": 48,
                        "vertical_alignment_flex_direction_column": "flex-start",
                        "background_image_position": "cover",
                        "background_image_opacity": 100,
                        "border": "none",
                        "border_width": 1,
                        "border_opacity": 100,
                        "undefined_setting": "list"
                      },
                      "blocks": [
                        {
                          "type": "text",
                          "settings": {
                            "text": "<h2>Heading</h2>"
                          }
                        },
                        {
                          "type": "text"
                        },
                        {
                          "type": "button"
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        }
        {% endschema %}
      `,
    };
    const offenses = await check(theme, [ValidPresetSettings]);
    expect(offenses).to.have.length(0);
  });
});
