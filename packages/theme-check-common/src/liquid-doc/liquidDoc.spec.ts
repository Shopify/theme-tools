import { expect, it, describe } from 'vitest';
import { toSourceCode } from '../to-source-code';
import { LiquidHtmlNode } from '../types';
import { getSnippetDefinition } from './liquidDoc';
import { toLiquidHtmlAST } from '@shopify/liquid-html-parser';

describe('Unit: getSnippetDefinition', () => {
  function toAST(code: string) {
    return toSourceCode('/tmp/foo.liquid', code).ast as LiquidHtmlNode;
  }

  it('should return default snippet definition if no renderable content is present', async () => {
    const ast = toAST(`
        {% doc %}
          just a description
          @undefined asdf
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [],
        examples: [],
      },
    });
  });

  it('should extract name, description and type from param annotations', async () => {
    const ast = toAST(`
        {% doc %}
          @param {String} firstParam - The first param
          @param {Number} secondParam - The second param
          @param {String} [optionalParam] - The optional param
          @param paramWithNoType - param with no type
          @param paramWithOnlyName
          @param {Number} paramWithNoDescription
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [
          {
            name: 'firstParam',
            description: 'The first param',
            type: 'String',
            required: true,
            nodeType: 'param',
          },
          {
            name: 'secondParam',
            description: 'The second param',
            type: 'Number',
            required: true,
            nodeType: 'param',
          },
          {
            name: 'optionalParam',
            description: 'The optional param',
            type: 'String',
            required: false,
            nodeType: 'param',
          },
          {
            name: 'paramWithNoType',
            description: 'param with no type',
            type: null,
            required: true,
            nodeType: 'param',
          },
          {
            name: 'paramWithOnlyName',
            description: null,
            type: null,
            required: true,
            nodeType: 'param',
          },
          {
            name: 'paramWithNoDescription',
            description: null,
            type: 'Number',
            required: true,
            nodeType: 'param',
          },
        ],
        examples: [],
      },
    });
  });

  it('should extract examples from @example annotations', async () => {
    const ast = toAST(`
        {% doc %}
          @example
          {{ product }}
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [],
        examples: [
          {
            content: '\n          {{ product }}\n',
            nodeType: 'example',
          },
        ],
      },
    });
  });

  it('should extract examples from @example annotations with multiple lines', async () => {
    const ast = toAST(`
        {% doc %}
          @example
          {{ product }}
          {{ product.title }}
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [],
        examples: [
          {
            content: '\n          {{ product }}\n          {{ product.title }}\n',
            nodeType: 'example',
          },
        ],
      },
    });
  });

  it('should extract example from @example and @param annotations', async () => {
    const ast = toAST(`
        {% doc %}
          @param {String} product - The product
          @example
          {{ product }} // This is an example
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [
          {
            name: 'product',
            description: 'The product',
            type: 'String',
            required: true,
            nodeType: 'param',
          },
        ],
        examples: [
          {
            content: '\n          {{ product }} // This is an example\n',
            nodeType: 'example',
          },
        ],
      },
    });
  });

  it('should extract multiple examples from @example annotations', async () => {
    const ast = toAST(`
        {% doc %}
          @example
          {{ product }}
          @example
          {{ product.title }}
        {% enddoc %}
      `);

    const result = getSnippetDefinition(ast, 'product-card');
    expect(result).to.deep.equal({
      name: 'product-card',
      liquidDoc: {
        parameters: [],
        examples: [
          {
            content: '\n          {{ product }}\n',
            nodeType: 'example',
          },
          {
            content: '\n          {{ product.title }}\n',
            nodeType: 'example',
          },
        ],
      },
    });
  });

  it('should parse parameters from doc comments', () => {
    const source = `
      {% doc %}
        @param {String} title - The title of the card
        @param {Number} [width] - The width of the card
        @param {String} description - The description of the card
      {% enddoc %}
      <div>{{ title }}</div>
      <div>{{ description }}</div>
    `;

    const ast = toLiquidHtmlAST(source, { allowUnclosedDocumentNode: false, mode: 'tolerant' });
    const definition = getSnippetDefinition(ast, 'card');

    expect(definition.liquidDoc?.parameters).toHaveLength(3);
    expect(definition.liquidDoc?.parameters?.[0]).toEqual({
      name: 'title',
      type: 'String',
      description: 'The title of the card',
      required: true,
      nodeType: 'param',
    });
    expect(definition.liquidDoc?.parameters?.[1]).toEqual({
      name: 'width',
      type: 'Number',
      description: 'The width of the card',
      required: false,
      nodeType: 'param',
    });
    expect(definition.liquidDoc?.parameters?.[2]).toEqual({
      name: 'description',
      type: 'String',
      description: 'The description of the card',
      required: true,
      nodeType: 'param',
    });
  });

  it('should parse examples from doc comments', () => {
    const source = `
      {% doc %}
        @example
          {% render 'card', title: 'My Card', description: 'A nice card' %}
        @example
          {% render 'card', title: 'Another Card', width: 100, description: 'Another nice card' %}
      {% enddoc %}
      <div>{{ title }}</div>
      <div>{{ description }}</div>
    `;

    const ast = toLiquidHtmlAST(source, { allowUnclosedDocumentNode: false, mode: 'tolerant' });
    const definition = getSnippetDefinition(ast, 'card');

    expect(definition.liquidDoc?.examples).toHaveLength(2);
    expect(definition.liquidDoc?.examples?.[0]).toEqual({
      content: "{% render 'card', title: 'My Card', description: 'A nice card' %}",
      nodeType: 'example',
    });
    expect(definition.liquidDoc?.examples?.[1]).toEqual({
      content:
        "{% render 'card', title: 'Another Card', width: 100, description: 'Another nice card' %}",
      nodeType: 'example',
    });
  });

  it('should handle snippets without doc comments', () => {
    const source = `
      <div>{{ title }}</div>
      <div>{{ description }}</div>
    `;

    const ast = toLiquidHtmlAST(source, { allowUnclosedDocumentNode: false, mode: 'tolerant' });
    const definition = getSnippetDefinition(ast, 'card');

    expect(definition.liquidDoc?.parameters).toHaveLength(0);
    expect(definition.liquidDoc?.examples).toHaveLength(0);
  });

  it('should handle empty doc comments', () => {
    const source = `
      {% doc %}
      {% enddoc %}
      <div>{{ title }}</div>
      <div>{{ description }}</div>
    `;

    const ast = toLiquidHtmlAST(source, { allowUnclosedDocumentNode: false, mode: 'tolerant' });
    const definition = getSnippetDefinition(ast, 'card');

    expect(definition.liquidDoc?.parameters).toHaveLength(0);
    expect(definition.liquidDoc?.examples).toHaveLength(0);
  });

  it('should handle malformed parameter definitions', () => {
    const source = `
      {% doc %}
        @param title - Missing type
        @param {String} - Missing name
        @param {InvalidType} name - Invalid type
      {% enddoc %}
      <div>{{ title }}</div>
    `;

    const ast = toLiquidHtmlAST(source, { allowUnclosedDocumentNode: false, mode: 'tolerant' });
    const definition = getSnippetDefinition(ast, 'card');

    expect(definition.liquidDoc?.parameters).toHaveLength(0);
  });

  it('should handle multiple doc comments and use the first one', () => {
    const source = `
      {% doc %}
        @param {String} title - First doc comment
      {% enddoc %}
      {% doc %}
        @param {String} title - Second doc comment
      {% enddoc %}
      <div>{{ title }}</div>
    `;

    const ast = toLiquidHtmlAST(source, { allowUnclosedDocumentNode: false, mode: 'tolerant' });
    const definition = getSnippetDefinition(ast, 'card');

    expect(definition.liquidDoc?.parameters).toHaveLength(1);
    expect(definition.liquidDoc?.parameters?.[0].description).toBe('First doc comment');
  });
});
