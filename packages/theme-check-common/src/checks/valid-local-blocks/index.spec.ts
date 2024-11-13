import { expect, describe, it } from 'vitest';
import { ValidLocalBlocks } from './index';
import { check, MockTheme } from '../../test';

it('should report errors when root level local blocks are defined in a block bucket', async () => {
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

it('should report errors when preset defined local blocks are defined in a block bucket', async () => {
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

it('should report errors when sections use static theme blocks together with locally scoped blocks', async () => {
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
                    "id": "static_block",
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
    'Sections cannot use static theme blocks together with locally scoped blocks.',
  );
});

it('should report errors with correct indicies when sections use static theme blocks together with locally scoped blocks', async () => {
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
                      "id": "static_block",
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

it('should report errors when static theme blocks have a name property', async () => {
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
                "id": "static_block",
                "type": "static_block",
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
  expect(offenses[0].message).to.equal('Static theme blocks cannot have a name property.');
});
