import { describe, it, expect } from 'vitest';
import { runLiquidCheck, highlightedOffenses } from '../../test';
import { ForbiddenTag, AppBlockValidTags } from './index';

const blocksFilePath = 'blocks/app.liquid';

describe('Module: AppBlockValidTags', () => {
  it.each(['include', 'layout', 'section', 'sections'])(
    'should report an offense when the forbidden tag %s is used in blocks directory liquid file',
    async (tag) => {
      const sourceCode = `
    {% ${tag} 'test' %}
    {% schema %}
    { }
    {% endschema %}
      `;

      const offenses = await runLiquidCheck(AppBlockValidTags, sourceCode, blocksFilePath);

      const expectedStart = {
        index: 5,
        line: 1,
        character: 4,
      };
      const tagEndOffset = 13;
      const endOffset = tag.length + tagEndOffset;

      const expectedEnd = {
        index: expectedStart.index + endOffset,
        line: expectedStart.line,
        character: expectedStart.character + endOffset,
      };

      expect(offenses).to.have.length(1);
      expect(offenses).to.containOffense({
        check: AppBlockValidTags.meta.code,
        message: `Theme app extension blocks cannot contain '${tag}' tags`,
        absolutePath: '/blocks/app.liquid',
        severity: 0,
        start: expectedStart,
        end: expectedEnd,
      });
    },
  );

  it.each(['javascript', 'stylesheet'])(
    'should report an offense when the forbidden tag %s is used with an end tag in blocks directory liquid file',
    async (tag) => {
      const sourceCode = `
    {% ${tag} %}
    {% end${tag} %}
    {% schema %}
    { }
    {% endschema %}
      `;

      const offenses = await runLiquidCheck(AppBlockValidTags, sourceCode, blocksFilePath);

      const expectedStart = {
        index: 5,
        line: 1,
        character: 4,
      };
      const expectedEnd = {
        index: expectedStart.index + tag.length + 30,
        line: 2,
        character: expectedStart.character + tag.length + 9,
      };

      expect(offenses).to.have.length(1);
      expect(offenses).to.containOffense({
        check: AppBlockValidTags.meta.code,
        message: `Theme app extension blocks cannot contain '${tag}' tags`,
        absolutePath: '/blocks/app.liquid',
        severity: 0,
        start: expectedStart,
        end: expectedEnd,
      });
    },
  );

  it('should contain specifically the following forbidden tags', async () => {
    const actualTagValues = Object.values(ForbiddenTag);
    const expectedTagValues = [
      'javascript',
      'stylesheet',
      'include',
      'layout',
      'section',
      'sections',
    ];

    expectedTagValues.forEach((tag) => expect(actualTagValues).toContain(tag));
    expect(actualTagValues.length).toBe(expectedTagValues.length);
  });
});
