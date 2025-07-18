import { expect, describe, it } from 'vitest';
import { highlightedOffenses, runLiquidCheck } from '../../test';
import { PaginationSize } from './index';

describe('Module: PaginationSize', () => {
  it('should report an offense when paginate size is less than minSize', async () => {
    const sourceCode = `
      {% paginate collection.products by 0 %}
      {% endpaginate %}
    `;
    const offenses = await runLiquidCheck(PaginationSize, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Pagination size must be a positive integer between 1 and 250.',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['0']);
  });

  it('should report an offense when paginate size is greater than maxSize', async () => {
    const sourceCode = `
      {% paginate collection.products by 251 %}
      {% endpaginate %}
    `;

    const offenses = await runLiquidCheck(PaginationSize, sourceCode);

    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Pagination size must be a positive integer between 1 and 250.',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['251']);
  });

  it('should not report an offense when paginate size is within the minSize and maxSize range', async () => {
    const sourceCode = `
      {% paginate collection.products by 25 %}
      {% endpaginate %}
    `;

    const offenses = await runLiquidCheck(PaginationSize, sourceCode);
    expect(offenses).to.have.length(0);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });

  it('should not report an offense when paginate size is a section setting with a valid default value', async () => {
    const sourceCode = `
      {% paginate collection.products by section.settings.products_per_page %}
      {% endpaginate %}
      {% schema %}
        {
          "name": "test",
          "settings": [
            {
              "type": "number",
              "id": "products_per_page",
              "label": "Products per Page",
              "default": 12
            }
          ]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(PaginationSize, sourceCode);
    expect(offenses).to.have.length(0);
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });

  it('should report an offense when paginate size is a section setting with an invalid default value', async () => {
    const sourceCode = `
      {% paginate collection.products by section.settings.products_per_page %}
      {% endpaginate %}
      {% schema %}
        {
          "name": "test",
          "settings": [
            {
              "type": "number",
              "id": "products_per_page",
              "label": "Products per Page",
              "default": 251
            }
          ]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(PaginationSize, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      `This setting's default value should be between 1 and 250 but is currently 251.`,
    );
    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['section.settings.products_per_page']);
  });

  it('should report an offense when paginate size is a section setting with a missing default value', async () => {
    const sourceCode = `
      {% paginate collection.products by section.settings.products_per_page %}
      {% endpaginate %}
      {% schema %}
        {
          "name": "test",
          "settings": [
            {
              "type": "number",
              "id": "products_per_page",
              "label": "Products per Page"
            }
          ]
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(PaginationSize, sourceCode);
    expect(offenses).to.have.length(1);
    expect(offenses[0].message).to.equal(
      'Default pagination size should be defined in the section settings.',
    );

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.eql(['section.settings.products_per_page']);
  });

  it('should not report an offense when settings is not an array', async () => {
    const sourceCode = `
      {% paginate collection.products by section.settings.products_per_page %}
      {% endpaginate %}
      {% schema %}
        {
          "name": "test",
          "settings": {
            "products_per_page": {
              "type": "number",
              "id": "products_per_page",
              "label": "Products per Page",
              "default": 51
            }
          }
        }
      {% endschema %}
    `;

    const offenses = await runLiquidCheck(PaginationSize, sourceCode);
    expect(offenses).to.have.length(0);

    const highlights = highlightedOffenses({ 'file.liquid': sourceCode }, offenses);
    expect(highlights).to.be.empty;
  });
});
