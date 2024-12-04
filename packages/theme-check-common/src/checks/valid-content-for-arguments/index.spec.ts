import { describe, expect, it } from 'vitest';
import { ValidContentForArguments } from '.';
import { runLiquidCheck } from '../../test';

describe('Module: ValidContentForArguments', () => {
  describe('{% content_for "unknown" %}', () => {
    it('should not report offenses for strategies we do not know or support yet', async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "snippet", closest.product: product %}',
      );
      expect(offenses).toHaveLength(0);
    });
  });

  describe('{% content_for "blocks" %}', () => {
    it('should accept `closest.*` kwargs', async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "blocks", closest.product: product %}',
      );
      expect(offenses).toHaveLength(0);
    });

    it('should report offenses for non-`closest.*` kwargs', async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "blocks", product: product %}',
      );
      expect(offenses).toHaveLength(1);
      expect(offenses[0]!.message).to.equal(
        `{% content_for "blocks" %} only accepts 'closest.*' arguments`,
      );
    });

    it('should report offenses for deprecated `context.*` kwargs', async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "blocks", context.product: product %}',
      );
      expect(offenses).toHaveLength(2);
      expect(offenses[0]!.message).to.equal(
        `{% content_for "blocks" %} only accepts 'closest.*' arguments`,
      );

      expect(offenses[1]!.message).to.equal(
        `{% content_for "blocks" %} only accepts 'closest.*' arguments. The 'context.*' arguments usage has been deprecated.`,
      );
    });
  });

  describe('{% content_for "block", type: "", id: "" %}', () => {
    it('should accept valid arguments', async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "block", type: "text", id: "static-block" %}',
      );
      expect(offenses).toHaveLength(0);
    });

    it(`should report an offense if 'type' is not a string`, async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "block", type: 10, id: "static-block" %}',
      );
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).to.equal(`The 'type' argument should be a string`);
    });

    it(`should report an offense if 'id' is not a string`, async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "block", type: "foo", id: (0..10) %}',
      );
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).to.equal(`The 'id' argument should be a string`);
    });

    it(`should report an offense if other kwargs are passed that are not named 'closest.*'`, async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "block", type: "foo", id: "id", product: product %}',
      );
      expect(offenses).toHaveLength(1);
      expect(offenses[0].message).to.equal(
        `{% content_for "block" %} only accepts 'id', 'type' and 'closest.*' arguments`,
      );
    });

    it('should report offenses for deprecated `context.*` kwargs', async () => {
      const offenses = await runLiquidCheck(
        ValidContentForArguments,
        '{% content_for "block", type: "type", id: "static-block", context.product: product %}',
      );
      expect(offenses).toHaveLength(2);
      expect(offenses[0]!.message).to.equal(
        `{% content_for "block" %} only accepts 'id', 'type' and 'closest.*' arguments`,
      );

      expect(offenses[1]!.message).to.equal(
        `{% content_for "block" %} accepts 'closest.*' arguments. The 'context.*' arguments usage has been deprecated.`,
      );
    });
  });
});
