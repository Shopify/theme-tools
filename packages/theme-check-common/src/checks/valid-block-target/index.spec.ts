import { expect, describe, it } from 'vitest';
import { ValidBlockTarget } from './index';
import { check, MockFileSystem, MockTheme } from '../../test';

describe('Module: ValidBlockTarget', () => {
  const paths = ['sections', 'blocks'];

  describe('Allowed Targeting Tests', () => {
    paths.forEach((path) => {
      it(`should report errors for further nested blocks when they are not allowed (${path} bucket)`, async () => {
        const theme: MockTheme = {
          'blocks/image.liquid': '',
          'blocks/group.liquid': `
            {% schema %}
            {
              "name": "Group",
              "blocks": [
                {
                  "type": "text"
                }
              ]
            }
            {% endschema %}
          `,
          'blocks/text.liquid': '',
          'blocks/slide.liquid': `
            {% schema %}
            {
              "name": "Slide",
              "blocks": [
                {
                  "type": "group"
                }
              ]
            }
            {% endschema %}
          `,
          [`${path}/slideshow.liquid`]: `
            {% schema %}
            {
              "name": "Slideshow",
              "blocks": [
                {
                  "type": "slide"
                }
              ],
              "presets": [
                {
                  "name": "Default",
                  "blocks": [
                    {
                      "type": "slide",
                      "blocks": [
                        {
                          "type": "group",
                          "blocks": [
                            {
                              "type": "image"
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

        const offenses = await check(theme, [ValidBlockTarget]);
        expect(offenses).to.have.length(1);
        expect(offenses[0].message).to.equal(
          'Block type "image" is not allowed in "group" blocks. Allowed types are: text.',
        );

        // Also when the file system answers slowly
        const fs = new SlowFileSystem(theme);
        expect(await check(theme, [ValidBlockTarget], { fs })).to.have.length(1);
      });
    });
  });
});

// Answers like MockFileSystem, a moment later.
class SlowFileSystem extends MockFileSystem {
  async stat(uri: string) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    return super.stat(uri);
  }
}
