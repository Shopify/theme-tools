import { describe, expect, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { ValidStandardEventData } from './index';

describe('Module: ValidStandardEventData', () => {
  it('reports an offense when the context is not a supported value', async () => {
    const sourceCode = `{{ product | standard_event_data: 'view', context: 'homepage' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported context 'homepage'. Valid values: page, search, collection, dialog, recommendation",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql("'homepage'");
  });

  it('reports an offense when the context is not a supported value on a cart', async () => {
    const sourceCode = `{{ cart | standard_event_data: 'view', context: 'banner' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported context 'banner'. Valid values: page, search, collection, dialog, recommendation",
    );
  });

  it('does not report an offense on supported context values', async () => {
    const contexts = ['page', 'search', 'collection', 'dialog', 'recommendation'];

    for (const context of contexts) {
      const sourceCode = `{{ product | standard_event_data: 'view', context: '${context}' }}`;
      const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

      expect(offenses, `expected '${context}' to be a valid context`).toHaveLength(0);
    }
  });

  it('does not report an offense when the context is not a string literal', async () => {
    const sourceCode = `{{ product | standard_event_data: 'view', context: section.settings.context }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('does not report an offense when the context argument is omitted', async () => {
    const sourceCode = `{{ collection | standard_event_data: 'view' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('reports an offense when the event type is not supported', async () => {
    const sourceCode = `{{ product | standard_event_data: 'click', context: 'page' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported event type 'click'. The only supported event type is 'view'.",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql("'click'");
  });

  it('does not report an offense when the event type is not a string literal', async () => {
    const sourceCode = `{{ product | standard_event_data: event_type }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('reports both offenses when the event type and the context are invalid', async () => {
    const sourceCode = `{{ product | standard_event_data: 'click', context: 'homepage' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(2);
  });

  it('does not report an offense on other filters', async () => {
    const sourceCode = `{{ product | json }}{{ 'homepage' | append: 'view' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });
});
