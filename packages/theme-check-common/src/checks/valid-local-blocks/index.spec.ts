import { expect, describe, it } from 'vitest';
import { ValidLocalBlocks } from './index';
import { check, MockTheme } from '../../test';

it('should report error when local blocks are defined in a block bucket', async () => {
  const theme: MockTheme = {
    'blocks/local-blocks.liquid': `
      {% schema %}
      {
        "name": "Block name",
        "blocks": [
          {
            "type": "local_block",
            "name": "Local Block"
          }
        ]
      }
      {% endschema %}
    `,
  };

  const offenses = await check(theme, [ValidLocalBlocks]);
  expect(offenses).to.have.length(1);
  expect(offenses[0].message).to.equal('Local scoped blocks are not supported in theme blocks.');
});

it('should report local block errors when preset defined local blocks are defined in a block bucket', async () => {
  const theme: MockTheme = {
    'blocks/text.liquid': '',
    'blocks/local-blocks.liquid': `
      {% schema %}
      {
        "name": "Block name",
        "blocks": [
          {
            "type": "text"
          }
        ],
        "presets": [
          {
            "name": "Default",
            "blocks": [
              {
                "type": "local_block",
                "name": "Local Block"
              }
            ]
          }
        ]
      }
      {% endschema %}
    `,
  };

  const offenses = await check(theme, [ValidLocalBlocks]);
  expect(offenses).to.have.length(1);
  expect(offenses[0].message).to.equal('Local scoped blocks are not supported in theme blocks.');
});

it('should report errors when sections use theme blocks together with locally scoped blocks in root level', async () => {
  const theme: MockTheme = {
    'blocks/text.liquid': '',
    'sections/local-blocks.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "text"
          },
          {
            "type": "local_block",
            "name": "Local Block"
          }
        ]
      }
      {% endschema %}
    `,
  };
  const offenses = await check(theme, [ValidLocalBlocks]);
  expect(offenses).to.have.length(1);
  expect(offenses[0].message).to.equal(
    'Sections cannot use theme blocks together with locally scoped blocks.',
  );
});

it('should report errors when sections use theme blocks together with locally scoped blocks in presets level', async () => {
  const theme: MockTheme = {
    'blocks/text.liquid': '',
    'sections/local-blocks.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "local_block",
            "name": "Local Block"
          }
        ],
        "presets": [
          {
            "name": "Default",
            "blocks": [
              {
                "type": "text"
              }
            ]
          }
        ]
      }
      {% endschema %}
    `,
  };

  const offenses = await check(theme, [ValidLocalBlocks]);
  console.log(offenses);
  expect(offenses).to.have.length(1);
  expect(offenses[0].message).to.equal(
    'Sections cannot use theme blocks together with locally scoped blocks.',
  );
});

it('should report errors when sections use static blocks without @theme', async () => {
  const theme: MockTheme = {
    'sections/local-blocks.liquid': `
          {% schema %}
          {
            "name": "Section name",
            "blocks": [
              {
                "type": "local_block",
                "name": "Local Block"
              }
            ],
            "presets": [
              {
                "name": "Default",
                "blocks": [
                  {
                    "type": "local_block",
                    "name": "Local Block"
                  },
                  {
                    "type": "static_block",
                    "static": true
                  }
                ]
              }
            ]
          }
          {% endschema %}
        `,
  };
  const offenses = await check(theme, [ValidLocalBlocks]);
  expect(offenses).to.have.length(1);
  expect(offenses[0].message).to.equal(
    'Root level blocks must target @theme or @static_block before you can use it.',
  );
});

it('should report errors with correct indicies when sections use static blocks without @theme', async () => {
  const theme: MockTheme = {
    'sections/local-blocks.liquid': `
            {% schema %}
            {
              "name": "Section name",
              "blocks": [
                {
                  "type": "local_block",
                  "name": "Local Block"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "local_block",
                      "name": "Local Block"
                    },
                    {
                      "type": "static_block",
                      "static": true
                    }
                  ]
                }
              ]
            }
            {% endschema %}
          `,
  };
  const offenses = await check(theme, [ValidLocalBlocks]);
  expect(offenses).to.have.length(1);

  const content = theme['sections/local-blocks.liquid'];
  const errorContent = content.slice(offenses[0].start.index, offenses[0].end.index);
  expect(errorContent).to.equal('"static_block"');
});

it('should not report errors when sections mix static and local blocks with @theme', async () => {
  const theme: MockTheme = {
    'sections/local-blocks.liquid': `
          {% schema %}
          {
            "name": "Section name",
            "blocks": [
              {
                "type": "@theme"
              }
            ],
            "presets": [
              {
                "name": "Default",
                "blocks": [
                  {
                    "type": "local_block",
                    "name": "Local Block"
                  },
                  {
                    "type": "static_block",
                    "static": true
                  }
                ]
              }
            ]
          }
          {% endschema %}
        `,
  };
  const offenses = await check(theme, [ValidLocalBlocks]);
  expect(offenses).to.have.length(0);
});

it('should report errors when static blocks have a name', async () => {
  const theme: MockTheme = {
    'blocks/text.liquid': '',
    'sections/local-blocks.liquid': `
      {% schema %}
      {
        "name": "Section name",
        "blocks": [
          {
            "type": "@theme"
          }
        ],
        "presets": [
          {
            "name": "Default",
            "blocks": [
              {
                "type": "text",
                "static": true,
                "name": "Static Text Block"
              }
            ]
          }
        ]
      }
      {% endschema %}
    `,
  };
  const offenses = await check(theme, [ValidLocalBlocks]);
  expect(offenses).to.have.length(1);
  expect(offenses[0].message).to.equal('Static blocks cannot have a name.');
});
