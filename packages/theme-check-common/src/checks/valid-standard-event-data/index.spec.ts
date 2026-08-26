import { describe, expect, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { ValidStandardEventData } from './index';

describe('Module: ValidStandardEventData', () => {
  it('reports an offense when the context is not a supported value for products', async () => {
    const sourceCode = `{{ product | standard_event_data: 'view', context: 'homepage' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported context 'homepage' for product. Valid values: page, search, collection, dialog, recommendation. The 'context' argument can also be omitted.",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql("'homepage'");
  });

  it('reports an offense when the context is not a supported value for carts', async () => {
    const sourceCode = `{{ cart | standard_event_data: 'view', context: 'banner' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported context 'banner' for cart. Valid values: page, dialog. The 'context' argument can also be omitted.",
    );
  });

  it('reports an offense when the context is valid for products but the input is a cart', async () => {
    const sourceCode = `{{ cart | standard_event_data: 'view', context: 'recommendation' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported context 'recommendation' for cart. Valid values: page, dialog. The 'context' argument can also be omitted.",
    );
  });

  it('does not report an offense on supported product context values', async () => {
    const contexts = ['page', 'search', 'collection', 'dialog', 'recommendation'];

    for (const context of contexts) {
      const sourceCode = `{{ product | standard_event_data: 'view', context: '${context}' }}`;
      const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

      expect(offenses, `expected '${context}' to be a valid product context`).toHaveLength(0);
    }
  });

  it('does not report an offense on supported cart context values', async () => {
    const contexts = ['page', 'dialog'];

    for (const context of contexts) {
      const sourceCode = `{{ cart | standard_event_data: 'view', context: '${context}' }}`;
      const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

      expect(offenses, `expected '${context}' to be a valid cart context`).toHaveLength(0);
    }
  });

  it('does not report an offense on collections, whose context is ignored', async () => {
    const sourceCode = `{{ collection | standard_event_data: 'view', context: 'homepage' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('falls back to the union of contexts when the input is not a known global', async () => {
    const sourceCode = `{{ line_item.product | standard_event_data: 'view', context: 'recommendation' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('falls back to the union of contexts when the filter input is chained', async () => {
    const sourceCode = `{{ cart | default: other_cart | standard_event_data: 'view', context: 'recommendation' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('reports an offense when the context is outside the union for an unknown input', async () => {
    const sourceCode = `{{ line_item.product | standard_event_data: 'view', context: 'homepage' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported context 'homepage'. Valid values: page, search, collection, dialog, recommendation. The 'context' argument can also be omitted.",
    );
  });

  it('does not report an offense when the context is a variable', async () => {
    const sourceCode = `{{ product | standard_event_data: 'view', context: section.settings.context }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('reports an offense when the context is a non-string literal', async () => {
    const sourceCode = `{{ product | standard_event_data: 'view', context: 123 }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported context for product. Valid values: page, search, collection, dialog, recommendation. The 'context' argument can also be omitted.",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql('123');
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

  it('reports an offense when the event type is not supported on a collection', async () => {
    const sourceCode = `{{ collection | standard_event_data: 'click' }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported event type 'click'. The only supported event type is 'view'.",
    );
  });

  it('does not report an offense when the event type is a variable', async () => {
    const sourceCode = `{{ product | standard_event_data: event_type }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(0);
  });

  it('reports an offense when the event type is a non-string literal', async () => {
    const sourceCode = `{{ product | standard_event_data: 123 }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported event type. The only supported event type is 'view'.",
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights[0]).to.eql('123');
  });

  it('reports an offense when the event type is a boolean literal', async () => {
    const sourceCode = `{{ product | standard_event_data: true }}`;
    const offenses = await runLiquidCheck(ValidStandardEventData, sourceCode);

    expect(offenses).toHaveLength(1);
    expect(offenses[0].message).toBe(
      "Unsupported event type. The only supported event type is 'view'.",
    );
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
