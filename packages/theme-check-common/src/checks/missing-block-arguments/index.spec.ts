import { describe, expect, it } from 'vitest';
import { MissingBlockArguments } from './index';
import {
  blockSource,
  INVALID_SCHEMA_BLOCK,
  liquidDocBlock,
  runBlockCallCheck,
} from '../../test/block-fixtures';

const DEVELOPER_BLOCK = blockSource(
  [{ id: 'title', type: 'text' }],
  ['@param {string} developer_id - Developer-only id'],
);

const REQUIRED_BUILT_IN_CONTENT_BLOCK = blockSource([], ['@param {string} content - Body']);
const REQUIRED_SCHEMA_CONTENT_BLOCK = blockSource(
  [{ id: 'content', type: 'text' }],
  ['@param {string} content - Body'],
);
const LIQUID_DOC_ONLY_BLOCK = liquidDocBlock(['@param {string} tracking_id - Tracking id']);

describe('MissingBlockArguments', () => {
  it.each([
    [
      'implicit platform defaults',
      [
        { id: 'title', type: 'text' },
        { id: 'enabled', type: 'checkbox' },
      ],
    ],
    [
      'explicit schema defaults',
      [
        { id: 'columns', type: 'range', min: 1, max: 4, step: 1, default: 2 },
        { id: 'heading_font', type: 'font_picker', default: 'assistant_n4' },
      ],
    ],
    [
      'settings that forbid defaults',
      [
        { id: 'product', type: 'product' },
        { id: 'image', type: 'image_picker' },
      ],
    ],
  ])('does not require schema settings with %s', async (_name, settings) => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      blockSource(settings),
    );

    expect(offenses).toEqual([]);
  });

  it.each([
    [
      'an implicit platform default',
      { id: 'enabled', type: 'checkbox' },
      '@param {boolean} enabled - Enabled',
    ],
    [
      'an explicit schema default',
      { id: 'columns', type: 'range', min: 1, max: 4, step: 1, default: 2 },
      '@param {number} columns - Columns',
    ],
    [
      'a setting that forbids defaults',
      { id: 'image', type: 'image_picker' },
      '@param {image} image - Image',
    ],
  ])('requires a LiquidDoc echo of a schema setting with %s', async (_name, setting, doc) => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      blockSource([setting], [doc]),
    );

    expect(offenses).toMatchObject([
      { message: `Missing required argument '${setting.id}' in block tag for 'card'.` },
    ]);
  });

  it('keeps optional LiquidDoc echoes of schema settings optional', async () => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      blockSource([{ id: 'title', type: 'text' }], ['@param {string} [title] - Title']),
    );

    expect(offenses).toEqual([]);
  });

  it('applies requiredness to LiquidDoc-only developer parameters', async () => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      DEVELOPER_BLOCK,
    );

    expect(offenses).toMatchObject([
      { message: "Missing required argument 'developer_id' in block tag for 'card'." },
    ]);
  });

  it('requires LiquidDoc-only parameters from a schema-less block', async () => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      LIQUID_DOC_ONLY_BLOCK,
    );

    expect(offenses).toMatchObject([
      { message: "Missing required argument 'tracking_id' in block tag for 'card'." },
    ]);
  });

  it.each([
    ['built-in content', REQUIRED_BUILT_IN_CONTENT_BLOCK],
    ['schema-backed content', REQUIRED_SCHEMA_CONTENT_BLOCK],
  ])('accepts an explicit argument for required %s', async (_name, block) => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card', content: body %}{% endblock %}",
      block,
    );

    expect(offenses).toEqual([]);
  });

  it.each([
    ['text', "{% block 'card' %}Body{% endblock %}"],
    ['a comment', "{% block 'card' %}{% comment %}Hidden{% endcomment %}{% endblock %}"],
    ['an assignment', "{% block 'card' %}{% assign value = 'hidden' %}{% endblock %}"],
  ])('treats %s in the invocation body as required content', async (_name, template) => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      template,
      REQUIRED_BUILT_IN_CONTENT_BLOCK,
    );

    expect(offenses).toEqual([]);
  });

  it('accepts a body for required schema-backed content', async () => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}Body{% endblock %}",
      REQUIRED_SCHEMA_CONTENT_BLOCK,
    );

    expect(offenses).toEqual([]);
  });

  it('does not treat a whitespace-only body as required content', async () => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}\n  \t\n{% endblock %}",
      REQUIRED_BUILT_IN_CONTENT_BLOCK,
    );

    expect(offenses).toMatchObject([
      { message: "Missing required argument 'content' in block tag for 'card'." },
    ]);
  });

  it('requires schema-backed content when LiquidDoc declares it required', async () => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      REQUIRED_SCHEMA_CONTENT_BLOCK,
    );

    expect(offenses).toMatchObject([
      { message: "Missing required argument 'content' in block tag for 'card'." },
    ]);
  });

  it('keeps schema-backed content optional when LiquidDoc declares it optional', async () => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      blockSource([{ id: 'content', type: 'text' }], ['@param {string} [content] - Body']),
    );

    expect(offenses).toEqual([]);
  });

  it.each([
    ['missing target', undefined],
    ['invalid target schema', INVALID_SCHEMA_BLOCK],
  ])('does not report missing arguments for an unreadable %s', async (_name, block) => {
    const offenses = await runBlockCallCheck(
      MissingBlockArguments,
      "{% block 'card' %}{% endblock %}",
      block,
    );

    expect(offenses).toEqual([]);
  });
});
