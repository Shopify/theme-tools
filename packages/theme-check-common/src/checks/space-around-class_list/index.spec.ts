import { expect, describe, it } from 'vitest';
import { SpaceAroundClassList } from '.';
import { runLiquidCheck, highlightedOffenses } from '../../test';

describe('Module: SpaceAroundClassList', () => {
  it('allows the happy path', async () => {
    const file = `<div class="{{ block.settings | class_list }}">
      content  
    </div>
    `;

    const offenses = await runLiquidCheck(SpaceAroundClassList, file);

    expect(offenses).to.have.length(0);
  });

  describe('before class_list', () => {
    it('should report an offense when missing a space before class_list', async () => {
      const file = `<div class="other-class{{ block.settings | class_list }}">
        content
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        `Missing a space before using the class_list filter: 'other-class{{ block.settings | class_list'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['s']);
    });

    it('supports classes on new lines', async () => {
      const file = `<div class="
      other-class{{ block.settings | class_list }}">
        content  
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        `Missing a space before using the class_list filter: 'other-class{{ block.settings | class_list'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['s']);
    });

    it('supports arbitrary whitespace', async () => {
      const file = `<div class="other-class{{block.settings  |    class_list}}">
        content
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        `Missing a space before using the class_list filter: 'other-class{{block.settings  |    class_list'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['s']);
    });

    it('catches between multiple class_list filters', async () => {
      const file = `<div class="
      {{ block.settings.spacing | class_list }}
      oh-snap{{ block.settings.typography | class_list }}">
        content
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);
      expect(offenses).to.have.length(1);

      expect(offenses[0].message).toEqual(
        `Missing a space before using the class_list filter: 'oh-snap{{ block.settings.typography | class_list'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['p']);
    });
  });

  describe('after class_list', () => {
    it('should report an offense when missing a space after class_list', async () => {
      const file = `<div class="{{ block.settings | class_list }}other-class">
        content  
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        `Missing a space after using the class_list filter: 'block.settings | class_list }}other-class'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['o']);
    });

    it('supports classes on new lines', async () => {
      const file = `<div class="
      {{ block.settings | class_list }}other-class">
        content  
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        `Missing a space after using the class_list filter: 'block.settings | class_list }}other-class'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['o']);
    });

    it('supports arbitrary whitespace', async () => {
      const file = `<div class="{{block.settings|    class_list}}other-class">
        content
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);

      expect(offenses).to.have.length(1);
      expect(offenses[0].message).toEqual(
        `Missing a space after using the class_list filter: 'block.settings|    class_list}}other-class'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['o']);
    });

    it('catches between multiple class_list filters', async () => {
      const file = `<div class="
      {{ block.settings.spacing | class_list }}oh-snap
      {{ block.settings.typography | class_list }}">
        content
      </div>
      `;

      const offenses = await runLiquidCheck(SpaceAroundClassList, file);
      expect(offenses).to.have.length(1);

      expect(offenses[0].message).toEqual(
        `Missing a space after using the class_list filter: 'block.settings.spacing | class_list }}oh-snap'`,
      );

      const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
      expect(highlights).toEqual(['o']);
    });
  });
});
