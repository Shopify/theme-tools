import { expect, describe, it } from 'vitest';
import { EmptyBlockContent } from '.';
import { check, MockTheme } from '../../test';

describe('Module: EmptyBlockContent', () => {
  const paths = ['sections', 'blocks'];

  paths.forEach((path) => {
    it(`should not report offenses when the blocks array is not empty in ${path}`, async () => {
      const theme: MockTheme = {
        [`${path}/test_block.liquid`]: `
          <div> 
              {% content_for 'blocks' %}
          </div>
          {% schema %}
          {
              "name": "Test",
              "blocks": [
                {
                  "type": "test-block"
                }
              ]
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [EmptyBlockContent]);
      expect(offenses).to.have.length(0);
    });

    it(`should report offenses when the blocks array is empty in ${path}`, async () => {
      const theme: MockTheme = {
        [`${path}/test_block.liquid`]: `
          <div> 
              {% content_for 'blocks' %}
          </div>
          {% schema %}
          {
              "name": "Test",
              "blocks": []
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [EmptyBlockContent]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        `The 'content_for "blocks"' tag is present, but the blocks array is empty.`,
      );
    });

    it(`should report offenses when the blocks array is empty with the correct indices in ${path}`, async () => {
      const theme: MockTheme = {
        [`${path}/test_block.liquid`]: `
          <div> 
              {% content_for 'blocks' %}
          </div>
          {% schema %}
          {
              "name": "Test",
              "blocks": []
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [EmptyBlockContent]);
      expect(offenses).to.have.length(1);
      const content = theme[`${path}/test_block.liquid`];
      const erroredContent = content.slice(offenses[0].start.index, offenses[0].end.index);
      expect(erroredContent).to.equal("{% content_for 'blocks' %}");
    });

    it(`should report offenses when the blocks array has not been defined in ${path}`, async () => {
      const theme: MockTheme = {
        [`${path}/test_block.liquid`]: `
          <div> 
              {% content_for 'blocks' %}
          </div>
          {% schema %}
          {
              "name": "Test"
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [EmptyBlockContent]);
      expect(offenses).to.have.length(1);
      expect(offenses[0].message).to.equal(
        `The 'content_for "blocks"' tag is present, but the blocks array is not defined.`,
      );
    });

    it(`should not report offenses when 'content_for blocks' is not present in ${path}`, async () => {
      const theme: MockTheme = {
        [`${path}/test_block.liquid`]: `
          {% schema %}
          {
              "name": "Test",
              "blocks": [
                  {
                      "type": "test-block"
                  }
              ]
          }
          {% endschema %}
        `,
      };

      const offenses = await check(theme, [EmptyBlockContent]);
      expect(offenses).to.be.empty;
    });
  });
});
