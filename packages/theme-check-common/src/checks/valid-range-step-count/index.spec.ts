import { describe, expect, it } from 'vitest';
import { check, runJSONCheck } from '../../test';
import { ValidRangeStepCount, ValidRangeStepCountSettingsSchema } from './index';

function toLiquidFile(content: unknown) {
  return `
    {% schema %}
      ${JSON.stringify(content)}
    {% endschema %}
  `;
}

describe('Module: ValidRangeStepCount (Liquid schema)', () => {
  it('does not report when the step count is at the 101 limit', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'range', id: 'width', min: 0, max: 100, step: 1 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(0);
  });

  it('reports when the step count exceeds 101', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'range', id: 'width', min: 0, max: 200, step: 1 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/width/);
    expect(offenses[0].message).toMatch(/201 steps/);
    expect(offenses[0].message).toMatch(/at most 101/);
  });

  it('reports a step count that just barely exceeds the limit', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'range', id: 'width', min: 0, max: 101, step: 1 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/102 steps/);
  });

  it('does not report fractional ranges within the limit', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'range', id: 'rating', min: 1, max: 5, step: 0.1 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(0);
  });

  it('reports a fractional step that creates more than 101 values', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'range', id: 'value', min: 0, max: 20, step: 0.1 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/value/);
    expect(offenses[0].message).toMatch(/201 steps/);
  });

  it('suggests a step size that fits within the limit', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'range', id: 'width', min: 0, max: 200, step: 1 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/step ≥ 2/);
  });

  it('skips settings missing min/max/step', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'range', id: 'width', default: 50 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(0);
  });

  it('ignores non-range settings', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [{ type: 'number', id: 'count', default: 7 }],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(0);
  });

  it('reports each over-budget range setting independently', async () => {
    const theme = {
      'sections/example.liquid': toLiquidFile({
        name: 'Example',
        settings: [
          { type: 'range', id: 'a', min: 0, max: 500, step: 1 },
          { type: 'range', id: 'b', min: 0, max: 50, step: 1 },
          { type: 'range', id: 'c', min: 0, max: 1000, step: 1 },
        ],
      }),
    };

    const offenses = await check(theme, [ValidRangeStepCount]);
    expect(offenses).toHaveLength(2);
    expect(offenses.map((o) => o.message).join('\n')).toMatch(/"a"/);
    expect(offenses.map((o) => o.message).join('\n')).toMatch(/"c"/);
  });
});

describe('Module: ValidRangeStepCountSettingsSchema (config/settings_schema.json)', () => {
  it('reports an over-budget range setting in config/settings_schema.json', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [{ type: 'range', id: 'logo_width', min: 0, max: 200, step: 1 }],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidRangeStepCountSettingsSchema,
      source,
      'config/settings_schema.json',
    );
    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toMatch(/logo_width/);
  });

  it('does not report a within-budget range setting', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [{ type: 'range', id: 'logo_width', min: 50, max: 200, step: 2 }],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidRangeStepCountSettingsSchema,
      source,
      'config/settings_schema.json',
    );
    expect(offenses).toHaveLength(0);
  });

  it('does not run on files other than settings_schema.json', async () => {
    const source = JSON.stringify([
      {
        name: 'Layout',
        settings: [{ type: 'range', id: 'logo_width', min: 0, max: 200, step: 1 }],
      },
    ]);

    const offenses = await runJSONCheck(
      ValidRangeStepCountSettingsSchema,
      source,
      'config/other.json',
    );
    expect(offenses).toHaveLength(0);
  });
});
