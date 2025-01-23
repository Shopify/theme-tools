export const createHorizonBlockSchema = (presetSchema?: any, defaultSchema?: any) => {
  const schema = {
    name: 'Tabbed content',
    tag: null,
    blocks: [{ type: '_tab' }],
    settings: [
      {
        type: 'select',
        id: 'tab_style',
        label: 'Tab style',
        options: [
          { value: 'underline', label: 'Underline' },
          { value: 'pill', label: 'Pill' },
        ],
        default: 'underline',
      },
      {
        type: 'range',
        id: 'tab_underline_width',
        label: 'Underline width',
        min: 1,
        max: 10,
        step: 1,
        unit: 'px',
        default: 2,
        available_if: "{{ block.settings.tab_style == 'underline' }}",
      },
      {
        type: 'range',
        id: 'tab_pill_border_radius',
        label: 'Corner radius',
        min: 0,
        max: 100,
        step: 1,
        unit: 'px',
        default: 15,
        available_if: "{{ block.settings.tab_style == 'pill' }}",
      },
      {
        type: 'select',
        id: 'type_preset',
        label: 't:settings.heading_style',
        options: [
          {
            value: '',
            label: 't:options.default',
          },
          {
            value: 'paragraph',
            label: 't:options.paragraph',
          },
          {
            value: 'h1',
            label: 't:options.h1',
          },
          {
            value: 'h2',
            label: 't:options.h2',
          },
          {
            value: 'h3',
            label: 't:options.h3',
          },
          {
            value: 'h4',
            label: 't:options.h4',
          },
          {
            value: 'h5',
            label: 't:options.h5',
          },
          {
            value: 'h6',
            label: 't:options.h6',
          },
          {
            value: 'caption',
            label: 't:options.caption',
          },
        ],
        default: 'h6',
      },
      {
        type: 'checkbox',
        id: 'inherit_color_scheme',
        label: 't:settings.inherit_color_scheme',
        default: true,
      },
      {
        type: 'color_scheme',
        id: 'color_scheme',
        label: 't:settings.color_scheme',
        default: 'scheme-1',
        available_if: '{{ block.settings.inherit_color_scheme == false }}',
      },
      {
        type: 'header',
        content: 't:content.borders',
      },
      {
        type: 'select',
        id: 'border',
        label: 't:settings.borders',
        options: [
          {
            value: 'none',
            label: 't:options.none',
          },
          {
            value: 'solid',
            label: 't:options.solid',
          },
          {
            value: 'dashed',
            label: 't:options.dashed',
          },
        ],
        default: 'none',
      },
      {
        type: 'range',
        id: 'border_width',
        min: 0,
        max: 100,
        step: 1,
        unit: 'px',
        label: 't:settings.width',
        default: 1,
        available_if: "{{ block.settings.border != 'none' }}",
      },
      {
        type: 'range',
        id: 'border_opacity',
        min: 0,
        max: 100,
        step: 1,
        unit: '%',
        label: 't:settings.opacity',
        default: 100,
        available_if: "{{ block.settings.border != 'none' }}",
      },
      {
        type: 'range',
        id: 'border_radius',
        label: 't:settings.border_radius',
        min: 0,
        max: 100,
        step: 1,
        default: 0,
      },
      {
        type: 'header',
        content: 'Padding',
      },
      {
        type: 'range',
        id: 'padding-block-start',
        label: 'Top',
        min: 0,
        max: 100,
        step: 1,
        unit: 'px',
        default: 0,
      },
      {
        type: 'range',
        id: 'padding-block-end',
        label: 'Bottom',
        min: 0,
        max: 100,
        step: 1,
        unit: 'px',
        default: 0,
      },
      {
        type: 'range',
        id: 'padding-inline-start',
        label: 'Left',
        min: 0,
        max: 100,
        step: 1,
        unit: 'px',
        default: 0,
      },
      {
        type: 'range',
        id: 'padding-inline-end',
        label: 'Right',
        min: 0,
        max: 100,
        step: 1,
        unit: 'px',
        default: 0,
      },
    ],
    ...(presetSchema ? { presets: [presetSchema] } : {}),
    ...(defaultSchema ? { default: defaultSchema } : {}),
  };

  return `{% schema %}
  ${JSON.stringify(schema)}
  {% endschema %}`;
};

export const validHorizonPresetSchema = createHorizonBlockSchema({
  presetSchema: [
    {
      name: 'Tabbed content',
      settings: {
        tab_pill_border_radius: 15,
      },
      blocks: [
        {
          type: '_tab',
          settings: {
            title: 'Tab 1',
          },
          blocks: [
            {
              type: 'text',
            },
          ],
        },
        {
          type: '_tab',
          settings: {
            title: 'Tab 2',
          },
          blocks: [
            {
              type: 'text',
            },
          ],
        },
        {
          type: '_tab',
          settings: {
            title: 'Tab 3',
          },
          blocks: [
            {
              type: 'text',
            },
          ],
        },
      ],
    },
  ],
  defaultSchema: null,
});

export const validHorizonDefaultSchema = createHorizonBlockSchema({
  presetSchema: null,
  defaultSchema: {
    settings: {
      'padding-inline-start': 15,
    },
    blocks: [{ type: '_tab', settings: { title: 'Tab 1' }, blocks: [{ type: 'text' }] }],
  },
});

export const createDawnSectionSchema = (presetSchema?: any, defaultSchema?: any) => {
  const schema = {
    name: 't:sections.announcement-bar.name',
    max_blocks: 12,
    class: 'announcement-bar-section',
    enabled_on: {
      groups: ['header'],
    },
    settings: [
      {
        type: 'color_scheme',
        id: 'color_scheme',
        label: 't:sections.all.colors.label',
        default: 'scheme-4',
      },
      {
        type: 'checkbox',
        id: 'show_line_separator',
        default: true,
        label: 't:sections.header.settings.show_line_separator.label',
      },
      {
        type: 'header',
        content: 't:sections.announcement-bar.settings.header__1.content',
        info: 't:sections.announcement-bar.settings.header__1.info',
      },
      {
        type: 'checkbox',
        id: 'show_social',
        default: false,
        label: 't:sections.announcement-bar.settings.show_social.label',
      },
      {
        type: 'header',
        content: 't:sections.announcement-bar.settings.header__2.content',
      },
      {
        type: 'checkbox',
        id: 'auto_rotate',
        label: 't:sections.announcement-bar.settings.auto_rotate.label',
        default: false,
      },
      {
        type: 'range',
        id: 'change_slides_speed',
        min: 3,
        max: 10,
        step: 1,
        unit: 's',
        label: 't:sections.announcement-bar.settings.change_slides_speed.label',
        default: 5,
      },
      {
        type: 'header',
        content: 't:sections.announcement-bar.settings.header__3.content',
        info: 't:sections.announcement-bar.settings.header__3.info',
      },
      {
        type: 'checkbox',
        id: 'enable_country_selector',
        default: false,
        label: 't:sections.announcement-bar.settings.enable_country_selector.label',
      },
      {
        type: 'header',
        content: 't:sections.announcement-bar.settings.header__4.content',
        info: 't:sections.announcement-bar.settings.header__4.info',
      },
      {
        type: 'checkbox',
        id: 'enable_language_selector',
        default: false,
        label: 't:sections.announcement-bar.settings.enable_language_selector.label',
      },
    ],
    blocks: [
      {
        type: 'announcement',
        name: 't:sections.announcement-bar.blocks.announcement.name',
        settings: [
          {
            type: 'text',
            id: 'text',
            default: 't:sections.announcement-bar.blocks.announcement.settings.text.default',
            label: 't:sections.announcement-bar.blocks.announcement.settings.text.label',
          },
          {
            type: 'url',
            id: 'link',
            label: 't:sections.announcement-bar.blocks.announcement.settings.link.label',
          },
        ],
      },
      {
        type: '_tab',
        settings: {
          title: 'Tab 1',
        },
      },
    ],
    ...(presetSchema ? { presets: [presetSchema] } : {}),
    ...(defaultSchema ? { default: defaultSchema } : {}),
  };

  return `{% schema %}
  ${JSON.stringify(schema)}
  {% endschema %}`;
};

export const validDawnPresetSchema = createDawnSectionSchema({
  presetSchema: [
    {
      name: 't:sections.announcement-bar.presets.name',
      settings: {
        title: 'Tab name',
      },
      blocks: [
        {
          type: 'announcement',
          settings: {
            title: 'Tab name',
          },
        },
      ],
    },
  ],
  defaultSchema: null,
});

export const validDawnDefaultSchema = createDawnSectionSchema({
  presetSchema: null,
  defaultSchema: {
    settings: {
      title: 'Announcement bar',
    },
    blocks: [{ type: 'text', settings: { title: 'Announcement bar' } }],
  },
});

export const horizonNestedBlockSchema = `{% schema %}
{
  "name": "Tab",
  "blocks": [{ "type": "@theme" }],
  "tag": null,
  "settings": [
    {
      "type": "text",
      "default": "Tab name",
      "id": "title",
      "label": "Title"
    }
  ],
  "presets": [
    {
      "name": "Tab",
      "blocks": [{ "type": "text" }]
    }
  ]
}
{% endschema %}`;
