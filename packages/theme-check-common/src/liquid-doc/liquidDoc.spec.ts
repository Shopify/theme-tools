import { expect, it, describe } from 'vitest';
import { toSourceCode } from '../to-source-code';
import { LiquidHtmlNode } from '../types';
import { extractDocDefinition } from './liquidDoc';

describe('Unit: extractDocDefinition', () => {
  const uri = 'file:///snippets/fake.liquid';

  function toAST(code: string) {
    return toSourceCode(uri, code).ast as LiquidHtmlNode;
  }

  it('should return default doc definition if no renderable content is present', async () => {
    const ast = toAST(`
        {% doc %}
          just a description
          @undefined asdf
        {% enddoc %}
      `);

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {
        description: {
          content: 'just a description',
          nodeType: 'description',
        },
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

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
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

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {
        examples: [
          {
            content: '{{ product }}',
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

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {
        examples: [
          {
            content: '{{ product }}\n{{ product.title }}',
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

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
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
            content: '{{ product }} // This is an example',
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

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {
        examples: [
          {
            content: '{{ product }}',
            nodeType: 'example',
          },
          {
            content: '{{ product.title }}',
            nodeType: 'example',
          },
        ],
      },
    });
  });

  it('should extract description from @description annotations', async () => {
    const ast = toAST(`
        {% doc %}
          @description This is a description
        {% enddoc %}
      `);

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {
        description: {
          content: 'This is a description',
          nodeType: 'description',
        },
      },
    });
  });

  it('should extract only the first @description annotation', async () => {
    const ast = toAST(`
        {% doc %}
          @description This is a description
          @description This is another description
        {% enddoc %}
      `);

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {
        description: {
          content: 'This is a description',
          nodeType: 'description',
        },
      },
    });
  });

  it('should return snippetDefinition without liquidDoc property if doc header is not present', async () => {
    const ast = toAST(`
      <div>No doc header here</div>
    `);

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
    });
  });

  it('should return an empty liquidDoc definition doc header is present but empty', async () => {
    const ast = toAST(`
      {% doc %}{% enddoc %}
    `);

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {},
    });
  });

  it('should return implicit description if multiple descriptions are provided', async () => {
    const ast = toAST(`
      {% doc %}
        this is an implicit description
        in a header

        @param asdf

        @description with a description annotation
      {% enddoc %}
    `);

    const result = extractDocDefinition(uri, ast);
    expect(result).to.deep.equal({
      uri,
      liquidDoc: {
        description: {
          content: 'this is an implicit description\nin a header',
          nodeType: 'description',
        },
        parameters: [
          {
            name: 'asdf',
            description: null,
            type: null,
            required: true,
            nodeType: 'param',
          },
        ],
      },
    });
  });
});
