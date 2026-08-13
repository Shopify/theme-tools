import { expect, describe, it } from 'vitest';
import { check } from '../../test';
import { ValidSettingsKey, ValidSettingsKeyJSON } from './index';

describe('Module: ValidSettingsKey', () => {
  const schemaTemplate = {
    name: 'Example',
    settings: [
      {
        id: 'existent-setting',
        type: 'text',
        label: 'Example Text Setting',
      },
    ],
  };

  describe('default settings', () => {
    it('does not report an error when default setting exists', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          ...schemaTemplate,
          default: {
            settings: {
              'existent-setting': 'value',
            },
          },
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey]);
      expect(offenses).to.have.length(0);
    });

    it('reports an error when default setting does not exist', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          ...schemaTemplate,
          default: {
            settings: {
              'non-existent-setting': 'value',
            },
          },
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        `Setting 'non-existent-setting' does not exist in schema.`,
      );
    });

    it('does not report an error when missing default settings is referenced from a block schema', async () => {
      const theme = {
        'blocks/example.liquid': toLiquidFile({
          ...schemaTemplate,
          default: {
            settings: {
              'non-existent-setting': 'value',
            },
          },
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey]);
      expect(offenses).to.have.length(0);
    });
  });

  describe('presets settings', () => {
    it('does not report an error when presets setting exists', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          ...schemaTemplate,
          presets: [
            {
              settings: {
                'existent-setting': 'value',
              },
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey]);
      expect(offenses).to.have.length(0);
    });

    it('reports an error when presets setting does not exist', async () => {
      const theme = {
        'sections/example.liquid': toLiquidFile({
          ...schemaTemplate,
          presets: [
            {
              settings: {
                'non-existent-setting-1': 'value',
              },
            },
            {
              settings: {
                'non-existent-setting-2': 'value',
              },
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey]);
      expect(offenses).to.have.length(2);
      expect(offenses[0].message).to.equal(
        `Setting 'non-existent-setting-1' does not exist in schema.`,
      );
      expect(offenses[1].message).to.equal(
        `Setting 'non-existent-setting-2' does not exist in schema.`,
      );
    });
  });

  describe('template JSON section settings', () => {
    it('does not report an error when a template JSON section setting exists in the section schema', async () => {
      const theme = {
        'templates/page.json': JSON.stringify({
          sections: {
            'main-page': {
              type: 'main-page',
              settings: {
                heading_tag: 'h1',
              },
            },
          },
          order: ['main-page'],
        }),
        'sections/main-page.liquid': toLiquidFile({
          name: 'Main page',
          settings: [
            {
              id: 'heading_tag',
              type: 'select',
              label: 'Heading tag',
              options: [
                { value: 'h1', label: 'H1' },
                { value: 'h2', label: 'H2' },
              ],
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey, ValidSettingsKeyJSON]);
      expect(offenses).to.have.length(0);
    });

    it('reports an error when a template JSON section setting does not exist in the section schema', async () => {
      const theme = {
        'templates/page.json': JSON.stringify({
          sections: {
            'main-page': {
              type: 'main-page',
              settings: {
                heading_tagg: 'h1',
              },
            },
          },
          order: ['main-page'],
        }),
        'sections/main-page.liquid': toLiquidFile({
          name: 'Main page',
          settings: [
            {
              id: 'heading_tag',
              type: 'select',
              label: 'Heading tag',
              options: [
                { value: 'h1', label: 'H1' },
                { value: 'h2', label: 'H2' },
              ],
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey, ValidSettingsKeyJSON]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        `Setting 'heading_tagg' does not exist in 'sections/main-page.liquid'.`,
      );
    });
  });

  describe('template JSON block settings', () => {
    it('does not report an error when a template JSON block setting exists in the block schema', async () => {
      const theme = {
        'templates/page.json': JSON.stringify({
          sections: {
            'main-page': {
              type: 'main-page',
              blocks: {
                text: {
                  type: 'text',
                  settings: {
                    heading: 'Hello',
                  },
                },
              },
              block_order: ['text'],
            },
          },
          order: ['main-page'],
        }),
        'sections/main-page.liquid': toLiquidFile({
          name: 'Main page',
          blocks: [{ type: 'text' }],
        }),
        'blocks/text.liquid': toLiquidFile({
          name: 'Text',
          settings: [
            {
              id: 'heading',
              type: 'text',
              label: 'Heading',
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey, ValidSettingsKeyJSON]);
      expect(offenses).to.have.length(0);
    });

    it('reports an error when a template JSON block setting does not exist in the block schema', async () => {
      const theme = {
        'templates/page.json': JSON.stringify({
          sections: {
            'main-page': {
              type: 'main-page',
              blocks: {
                text: {
                  type: 'text',
                  settings: {
                    headingg: 'Hello',
                  },
                },
              },
              block_order: ['text'],
            },
          },
          order: ['main-page'],
        }),
        'sections/main-page.liquid': toLiquidFile({
          name: 'Main page',
          blocks: [{ type: 'text' }],
        }),
        'blocks/text.liquid': toLiquidFile({
          name: 'Text',
          settings: [
            {
              id: 'heading',
              type: 'text',
              label: 'Heading',
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey, ValidSettingsKeyJSON]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        `Setting 'headingg' does not exist in 'blocks/text.liquid'.`,
      );
    });

    it('reports an error when a template JSON local block setting does not exist in the section schema', async () => {
      const theme = {
        'templates/page.json': JSON.stringify({
          sections: {
            'main-page': {
              type: 'main-page',
              blocks: {
                foo: {
                  type: 'foo',
                  settings: {
                    headingg: 'Hello',
                  },
                },
              },
              block_order: ['foo'],
            },
          },
          order: ['main-page'],
        }),
        'sections/main-page.liquid': toLiquidFile({
          name: 'Main page',
          blocks: [
            {
              type: 'foo',
              name: 'Foo',
              settings: [
                {
                  id: 'heading',
                  type: 'text',
                  label: 'Heading',
                },
              ],
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey, ValidSettingsKeyJSON]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        `Setting 'headingg' does not exist in 'sections/main-page.liquid'.`,
      );
    });

    it('reports an error when a nested template JSON block setting does not exist in the nested block schema', async () => {
      const theme = {
        'templates/page.json': JSON.stringify({
          sections: {
            'main-page': {
              type: 'main-page',
              blocks: {
                parent: {
                  type: 'parent',
                  blocks: {
                    text: {
                      type: 'text',
                      settings: {
                        headingg: 'Hello',
                      },
                    },
                  },
                  block_order: ['text'],
                },
              },
              block_order: ['parent'],
            },
          },
          order: ['main-page'],
        }),
        'sections/main-page.liquid': toLiquidFile({
          name: 'Main page',
          blocks: [{ type: 'parent' }],
        }),
        'blocks/parent.liquid': toLiquidFile({
          name: 'Parent',
          blocks: [{ type: 'text' }],
        }),
        'blocks/text.liquid': toLiquidFile({
          name: 'Text',
          settings: [
            {
              id: 'heading',
              type: 'text',
              label: 'Heading',
            },
          ],
        }),
      };

      const offenses = await check(theme, [ValidSettingsKey, ValidSettingsKeyJSON]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        `Setting 'headingg' does not exist in 'blocks/text.liquid'.`,
      );
    });
  });

  const tests = [
    {
      label: 'default',
      blockTemplate: (blocks: any[]) => {
        return {
          default: {
            blocks,
          },
        };
      },
    },
    {
      label: 'presets',
      blockTemplate: (blocks: any[]) => {
        return {
          presets: [
            {
              blocks,
            },
          ],
        };
      },
    },
  ];

  tests.forEach(({ label, blockTemplate }) => {
    describe(`${label} block settings`, () => {
      describe('referenced blocks', () => {
        const referencedBlock = {
          'blocks/referenced.liquid': toLiquidFile(schemaTemplate),
        };

        it(`does not report an error when ${label} block setting exists in referenced file`, async () => {
          const fileToTest = {
            'sections/example.liquid': toLiquidFile({
              ...schemaTemplate,
              ...blockTemplate([
                {
                  type: 'referenced',
                  settings: {
                    'existent-setting': 'value',
                  },
                },
              ]),
            }),
          };

          const offenses = await check(
            {
              ...referencedBlock,
              ...fileToTest,
            },
            [ValidSettingsKey],
          );
          expect(offenses).to.have.length(0);
        });

        it('does not report an error when referenced file does not exist', async () => {
          const fileToTest = {
            'sections/example.liquid': toLiquidFile({
              ...schemaTemplate,
              ...blockTemplate([
                {
                  type: 'non-existent-file',
                  settings: {
                    'non-existent-setting': 'value',
                  },
                },
              ]),
            }),
          };

          const offenses = await check(
            {
              ...referencedBlock,
              ...fileToTest,
            },
            [ValidSettingsKey],
          );
          expect(offenses).to.have.length(0);
        });

        it(`reports an error when ${label} block setting does not exist in referenced file`, async () => {
          const fileToTest = {
            'sections/example.liquid': toLiquidFile({
              ...schemaTemplate,
              ...blockTemplate([
                {
                  type: 'referenced',
                  settings: {
                    'non-existent-setting': 'value',
                  },
                },
              ]),
            }),
          };

          const offenses = await check(
            {
              ...referencedBlock,
              ...fileToTest,
            },
            [ValidSettingsKey],
          );
          expect(offenses).to.have.length(1);
          expect(offenses[0].message).to.equal(
            `Setting 'non-existent-setting' does not exist in 'blocks/referenced.liquid'.`,
          );
        });
      });

      describe('local blocks', () => {
        const localBlocksTemplate = {
          blocks: [
            {
              type: 'local-block',
              name: 'Local block',
              settings: [
                {
                  id: 'local-setting',
                  type: 'text',
                  label: 'Local Setting',
                },
              ],
            },
          ],
        };

        it(`reports an error when ${label} block setting does not exist in existing local block`, async () => {
          const fileToTest = {
            'sections/example.liquid': toLiquidFile({
              ...localBlocksTemplate,
              ...blockTemplate([
                {
                  type: 'local-block',
                  settings: {
                    'non-existent-setting-1': 'value',
                    'non-existent-setting-2': 'value',
                  },
                },
              ]),
            }),
          };

          const offenses = await check(fileToTest, [ValidSettingsKey]);
          expect(offenses).to.have.length(2);
          expect(offenses[0].message).to.equal(
            `Setting 'non-existent-setting-1' does not exist in schema.`,
          );
          expect(offenses[1].message).to.equal(
            `Setting 'non-existent-setting-2' does not exist in schema.`,
          );
        });

        it(`does not report an error when ${label} block setting does not exist in non-existent local block`, async () => {
          const fileToTest = {
            'sections/example.liquid': toLiquidFile({
              ...localBlocksTemplate,
              ...blockTemplate([
                {
                  type: 'non-existent-local-block',
                  settings: {
                    'non-existent-setting': 'value',
                  },
                },
              ]),
            }),
          };

          const offenses = await check(fileToTest, [ValidSettingsKey]);
          expect(offenses).to.have.length(0);
        });

        it(`does not report an error when ${label} block setting exists in local block`, async () => {
          const fileToTest = {
            'sections/example.liquid': toLiquidFile({
              ...localBlocksTemplate,
              ...blockTemplate([
                {
                  type: 'local-block',
                  settings: {
                    'local-setting': 'value',
                  },
                },
              ]),
            }),
          };

          const offenses = await check(fileToTest, [ValidSettingsKey]);
          expect(offenses).to.have.length(0);
        });
      });
    });
  });
});

function toLiquidFile(content: any) {
  return `
    {% schema %}
      ${JSON.stringify(content)}
    {% endschema %}
  `;
}
