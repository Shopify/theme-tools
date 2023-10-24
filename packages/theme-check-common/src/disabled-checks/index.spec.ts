import { check } from '../test';
import { Offense } from '..';
import { describe, it, expect } from 'vitest';
import { LiquidFilter, RenderMarkup } from './test-checks';

const commentTypes = [
  (text: string) => `{% # ${text} %}`,
  (text: string) => `{% comment %}${text}{% endcomment %}`,
];

function expectLiquidFilterOffense(offenses: Offense[], file: string, assetName: string) {
  const expectedStart = file.indexOf(`'${assetName}' | random_filter`) + `'${assetName}'`.length;
  const expectedEnd = expectedStart + ' | random_filter'.length;
  const foundOffenses = offenses.filter(
    ({ message, start, end }) =>
      message === 'Liquid filter can not be used' &&
      start.index === expectedStart &&
      end.index === expectedEnd,
  );
  expect(foundOffenses).to.have.length(1);
}

function expectRenderMarkupOffense(offenses: Offense[], templateName: string) {
  const foundOffenses = offenses.filter(
    ({ message }) => message === `'${templateName}' can not be rendered`,
  );
  expect(foundOffenses).to.have.length(1);
}

describe('Module: DisabledChecks', () => {
  const checks = [LiquidFilter, RenderMarkup];

  describe(`Comment variant`, () => {
    it('should disable checks for the entire document if comment is placed on the first line', async () => {
      for (const buildComment of commentTypes) {
        const file = `${buildComment('theme-check-disable LiquidFilter')}
{% comment %}
  This is some comment about the file...
  Adding a comment here should not mess with theme-check-disable
{% endcomment %}
{{ 'asset' | random_filter }}
{% render 'something' %}`;

        const offenses = await check({ 'code.liquid': file }, checks);
        expect(offenses).to.have.length(1);
        expectRenderMarkupOffense(offenses, 'something.liquid');
      }
    });

    it('should disable all checks even if comment has additional spaces', async () => {
      for (const buildComment of commentTypes) {
        const file = `${buildComment('  theme-check-disable     ')}
{{ 'asset' | random_filter }}
{% render 'something' %}`;

        const offenses = await check({ 'code.liquid': file }, checks);
        expect(offenses).to.have.length(0);
      }
    });

    it('should disable all checks for a section of the template', async () => {
      for (const buildComment of commentTypes) {
        const file = `{{ 'asset-1' | random_filter }}
{% render 'something-1' %}
${buildComment('theme-check-disable')}
{{ 'asset-2' | random_filter }}
{% render 'something-2' %}
${buildComment('theme-check-enable')}
{{ 'asset-3' | random_filter }}`;

        const offenses = await check({ 'code.liquid': file }, checks);
        expect(offenses).to.have.length(3);
        expectLiquidFilterOffense(offenses, file, 'asset-1');
        expectLiquidFilterOffense(offenses, file, 'asset-3');
        expectRenderMarkupOffense(offenses, 'something-1.liquid');
      }
    });

    it('should disable a specific check if check is included in the comment', async () => {
      for (const buildComment of commentTypes) {
        const file = `${buildComment('theme-check-disable LiquidFilter')}
{{ 'asset-1' | random_filter }}
{% render 'something' %}
${buildComment('theme-check-enable LiquidFilter')}
{{ 'asset-2' | random_filter }}`;

        const offenses = await check({ 'code.liquid': file }, checks);
        expect(offenses).to.have.length(2);
        expectLiquidFilterOffense(offenses, file, 'asset-2');
        expectRenderMarkupOffense(offenses, 'something.liquid');
      }
    });

    it('should disable multiple checks if checks are separated by a comma (and maybe some spaces)', async () => {
      for (const buildComment of commentTypes) {
        const file = `${buildComment('theme-check-disable LiquidFilter, RenderMarkup')}
{{ 'asset-1' | random_filter }}
{% render 'something' %}
${buildComment('theme-check-enable LiquidFilter,RenderMarkup')}
{{ 'asset-2' | random_filter }}`;

        const offenses = await check({ 'code.liquid': file }, checks);
        expect(offenses).to.have.length(1);
        expectLiquidFilterOffense(offenses, file, 'asset-2');
      }
    });

    it('should enable specific checks individually', async () => {
      for (const buildComment of commentTypes) {
        const file = `${buildComment('theme-check-disable LiquidFilter, RenderMarkup')}
{{ 'asset-1' | random_filter }}
{% render 'something-1' %}
${buildComment('theme-check-enable RenderMarkup')}
{{ 'asset-2' | random_filter }}
{% render 'something-2' %}
${buildComment('theme-check-enable LiquidFilter')}
{{ 'asset-3' | random_filter }}
{% render 'something-3' %}`;

        const offenses = await check({ 'code.liquid': file }, checks);
        expect(offenses).to.have.length(3);
        expectLiquidFilterOffense(offenses, file, 'asset-3');
        expectRenderMarkupOffense(offenses, 'something-2.liquid');
        expectRenderMarkupOffense(offenses, 'something-3.liquid');
      }
    });

    describe('Mix of general and specific commands', () => {
      it('should not reenable specific check when all checks have been disabled before', async () => {
        for (const buildComment of commentTypes) {
          const file = `${buildComment('theme-check-disable')}
{{ 'asset-1' | random_filter }}
{% render 'something-1' %}
${buildComment('theme-check-enable RenderMarkup')}
{{ 'asset-2' | random_filter }}
{% render 'something-2' %}`;
          const offenses = await check({ 'code.liquid': file }, checks);
          expect(offenses).to.have.length(0);
        }
      });

      it('should reenable all checks when specific ones have been disabled before', async () => {
        for (const buildComment of commentTypes) {
          const file = `${buildComment('theme-check-disable LiquidFilter, RenderMarkup')}
{{ 'asset-3' | random_filter }}
{% render 'something-3' %}
${buildComment('theme-check-enable')}
{{ 'asset-4' | random_filter }}
{% render 'something-4' %}`;

          const offenses = await check({ 'code.liquid': file }, checks);
          expect(offenses).to.have.length(2);
          expectLiquidFilterOffense(offenses, file, 'asset-4');
          expectRenderMarkupOffense(offenses, 'something-4.liquid');
        }
      });
    });
  });
});
