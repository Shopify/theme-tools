import { expect, describe, it } from 'vitest';
import { toSchema, toSourceCode } from '../../index';
import { check } from '../../test';
import { ThemeBlockSchema } from '../../types';
import { ValidSettingsKey } from './index';

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

        it(`reports an error when ${label} block setting does not exist in a referenced file that loads slowly`, async () => {
          const theme = {
            ...referencedBlock,
            'sections/example.liquid': toLiquidFile({
              ...schemaTemplate,
              ...blockTemplate([{ type: 'referenced', settings: { 'non-existent-setting': 'v' } }]),
            }),
          };
          const uri = 'file:///blocks/referenced.liquid';
          const source = toSourceCode(uri, theme['blocks/referenced.liquid']);

          const offenses = await check(theme, [ValidSettingsKey], {
            async getBlockSchema() {
              await new Promise((resolve) => setTimeout(resolve, 10));
              return toSchema('theme', uri, source, async () => true) as Promise<
                ThemeBlockSchema | undefined
              >;
            },
          });
          expect(offenses).to.have.length(1);
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
