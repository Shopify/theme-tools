import { describe, expect, it } from 'vitest';
import { check } from '../../test/test-helper';
import { MockTheme } from '../../test/MockTheme';
import { ValidPresetAndDefaultSettings } from '.';

describe('ValidPresetAndDefaultSettings', () => {
  it('should report invalid keys in a blocks preset settings', async () => {
    const theme: MockTheme = {
      'blocks/test_block.liquid': `
        {% schema %}
        {
          "name": "t:names.test_block",
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
              "name": "t:names.test_block",
              "settings": {
                "product": "{{ context.product }}",
                "undefined_setting": "this is an invalid setting as this key does not exist"
              }
            }
          ]
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      'Preset setting "undefined_setting" does not exist in settings',
    );
  });

  it('should report invalid keys in a blocks default settings', async () => {
    const theme: MockTheme = {
      'blocks/test_block.liquid': `
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
          "default": {
            "settings": {
              "undefined_setting": "incorrect setting key"
            }
          }
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      'Default setting "undefined_setting" does not exist in settings',
    );
  });

  it('should report invalid keys in a blocks nested block preset settings', async () => {
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
      'blocks/test_block.liquid': `
        {% schema %}
        {
          "name": "t:names.test_block",
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
              "name": "Preset 1",
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
            }
          ]
        }
        {% endschema %}
      `,
    };

    // TODO: fix this test
    /**
    *  "block_1": {
          "type": "block_1",
          "settings": {
            "block_1_setting_key": "correct setting key",
            "undefined_setting": "incorrect setting key"
          }
        }
      }
    *
    * or
    *
     * {
     *  "type": "block_1",
     *  "settings": {
     *    "block_1_setting_key": "correct setting key",
     *    "undefined_setting": "incorrect setting key"
     *  }
     * }
     */
    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Preset block setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should report invalid keys in a blocks nested block default setting', async () => {
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
          "default": {
            "settings": {
              "product": "{{ context.product }}",
              "collection": "{{ context.collection }}"            },
            "blocks": [
              {
                  "type": "block_1",
                  "settings": {
                    "block_1_setting_key": "correct setting key",
                    "undefined_setting": "incorrect setting key"
                  }
              }
            ]
          }
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Default block setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should not report when all preset and default settings in the block are valid', async () => {
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
      'blocks/test_block.liquid': `
      {% schema %}
      {
        "name": "t:names.test_block",
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
                "type": "block_1",
                "settings": {
                  "block_1_setting_key": "correct setting key",
                }
              }
            ]
          }
        ],
        "default": {
          "settings": {
            "product": "{{ context.product }}",
            "section_setting": "some value"
          },
          "blocks": [
            {
              "type": "block_1",
              "settings": {
                "block_1_setting_key": "correct setting key",
              }
            }
          ]
        }
      }
      {% endschema %}
    `,
    };

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
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

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Preset setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should report invalid keys in a sections default setting', async () => {
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
          "default": {
            "settings": {
              "undefined_setting": "list"
            }
          }
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Default setting "undefined_setting" does not exist in settings`,
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
              "type": "range",
              "id": "gap",
              "label": "Gap",
              "min": 0,
              "max": 100,
              "unit": "px",
              "default": 16,
              "available_if": "{{ section.settings.show_as == 'list' }}"
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
                      "undefined_setting": "this is an invalid setting"
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

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.include(
      `Preset block setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should report invalid keys in a sections nested block default setting', async () => {
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
              "type": "range",
              "id": "gap",
              "label": "Gap",
              "min": 0,
              "max": 100,
              "unit": "px",
              "default": 16,
              "available_if": "{{ section.settings.show_as == 'list' }}"
            }
          ],
          "default": {
            "settings": {
              "gap": 20
            },
            "blocks": [
              {
                "type": "announcement",
                "settings": {
                  "undefined_setting": "this is an invalid setting"
                }
              }
            ]
          }
        }
        {% endschema %}
      `,
    };

    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses[0].message).to.include(
      `Default block setting "undefined_setting" does not exist in settings`,
    );
  });

  it('should not report when all preset and default settings in the section are valid', async () => {
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
              "type": "range",
              "id": "gap",
              "label": "Gap",
              "min": 0,
              "max": 100,
              "unit": "px",
              "default": 16,
              "available_if": "{{ section.settings.show_as == 'list' }}"
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
                      "text": "some text"
                    }
                  }
                }
              ]
            }
          ],
          "default": {
            "settings": {
              "gap": 20
            },
            "blocks": [
              {
                "type": "announcement",
                "settings": {
                 "text": "some text
                }
              }
            ]
          }
        }
        {% endschema %}
      `,
    };
    const offenses = await check(theme, [ValidPresetAndDefaultSettings]);
    expect(offenses).to.have.length(0);
  });
});
