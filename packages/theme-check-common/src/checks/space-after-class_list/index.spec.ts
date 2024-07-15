import { expect, describe, it } from 'vitest';
import { SpaceAfterClassList } from '.';
import { runLiquidCheck, highlightedOffenses } from '../../test';

describe('Module: SpaceAfterClassList', () => {

  it('allows the happy path', async () => {
    const file = `<div class="{{ block.settings | class_list }}">
      content  
    </div>
    `;

    const offenses = await runLiquidCheck(SpaceAfterClassList, file);

    expect(offenses).to.have.length(0);
  });

  it('should report an offense when missing a space', async () => {
    const file = `<div class="{{ block.settings | class_list }}other-class">
      content  
    </div>
    `;

    const offenses = await runLiquidCheck(SpaceAfterClassList, file);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).toEqual(`Missing a space after using the class_list filter: 'block.settings | class_list }}other-class'`);

    const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
    expect(highlights).toEqual(['o']);
  });

  it('supports classes on new lines', async () => {
    const file = `<div class="
    {{ block.settings | class_list }}other-class">
      content  
    </div>
    `;

    const offenses = await runLiquidCheck(SpaceAfterClassList, file);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).toEqual(`Missing a space after using the class_list filter: 'block.settings | class_list }}other-class'`);

    const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
    expect(highlights).toEqual(['o']);
  });

  it('supports arbitrary whitespace', async () => {
    const file = `<div class="{{block.settings|    class_list}}other-class">
      content
    </div>
    `;

    const offenses = await runLiquidCheck(SpaceAfterClassList, file);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).toEqual(`Missing a space after using the class_list filter: 'block.settings|    class_list}}other-class'`);

    const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
    expect(highlights).toEqual(['o']);
  });

  it('catches between multiple class_list filters', async () => {
    const file = `<div class="
    {{ block.settings.spacing | class_list }}oh-no
    {{ block.settings.typography | class_list }}">
      content
    </div>
    `;

    const offenses = await runLiquidCheck(SpaceAfterClassList, file);
    expect(offenses).to.have.length(1);

    expect(offenses[0].message).toEqual(`Missing a space after using the class_list filter: 'block.settings.spacing | class_list }}oh-no'`);

    const highlights = highlightedOffenses({ 'file.liquid': file }, offenses);
    expect(highlights).toEqual(['o']);
  });
});
