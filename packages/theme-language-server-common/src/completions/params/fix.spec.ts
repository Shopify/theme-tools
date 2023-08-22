import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fix } from './fix';

const scenarios = fs
  .readFileSync(path.join(__dirname, './testcases.txt'), 'utf8')
  .replace(/^#[^\n]*\n/gm, '')
  .trim()
  .split('\n\n')
  .map((pairs) => pairs.split('\n'))
  .map(([source, expected]) => ({ source: source.replace(/█.*/, ''), expected }));

describe('Unit: fix', async () => {
  it('closes open strings inside Liquid output', () => {
    expect(fix(`{{ 'hello`)).to.equal(`{{ 'hello'}}`);
    expect(fix(`{{ "hello`)).to.equal(`{{ "hello"}}`);
    expect(fix(`{{ 'hello' | append: ' world`)).to.equal(`{{ 'hello' | append: ' world'}}`);
    expect(fix(`{{ "hello" | append: " world`)).to.equal(`{{ "hello" | append: " world"}}`);
    expect(fix(`{{ 'hello' | replace: 'hello', 'hi`)).to.equal(
      `{{ 'hello' | replace: 'hello', 'hi'}}`,
    );
    expect(fix(`{{ "hello" | replace: "hello", "hi`)).to.equal(
      `{{ "hello" | replace: "hello", "hi"}}`,
    );
    expect(fix(`{{ "don't freak out`)).to.equal(`{{ "don't freak out"}}`);
    expect(fix(`{{ 'he said: "no way!`)).to.equal(`{{ 'he said: "no way!'}}`);
  });

  it('does not close strings inside text blocks', () => {
    expect(fix(`<a href="hi">don't freak out<img href`)).to.equal(
      `<a href="hi">don't freak out<img href>`,
    );
    expect(fix(`<a href="hi">a quote "<img href`)).to.equal(`<a href="hi">a quote "<img href>`);
  });

  it('does not close parens inside text blocks', () => {
    expect(fix(`<a>([<b`)).to.equal(`<a>([<b>`);
    expect(fix(`<a>])<b`)).to.equal(`<a>])<b>`);
  });

  it('does not care about brackets inside strings', () => {
    expect(fix(`<a attr="([`)).to.equal(`<a attr="([">`);
    expect(fix(`<a attr="%}`)).to.equal(`<a attr="%}">`);
    expect(fix(`<a attr="}}`)).to.equal(`<a attr="}}">`);
    expect(fix(`{{ "([`)).to.equal(`{{ "(["}}`);
    expect(fix(`{% echo "([`)).to.equal(`{% echo "(["%}`);
  });

  it('should panic gracefully', () => {
    expect(fix(`{{ "}}`)).to.equal(`{{ "}}`);
    expect(fix(`{% "%}`)).to.equal(`{% "%}`);
    expect(fix(`<a href=">`)).to.equal(`<a href=">`);
    expect(fix(`<a href="{% echo '>%}`)).to.equal(`<a href="{% echo '>%}">`);
  });

  it('closes multiline stuff', () => {
    expect(fix(`\n{{\n\n  'hello`)).to.equal(`\n{{\n\n  'hello'}}`);
  });

  it('does not close closed strings inside Liquid output', () => {
    expect(fix(`{{ 'hello'`)).to.equal(`{{ 'hello'}}`);
    expect(fix(`{{ "hello"`)).to.equal(`{{ "hello"}}`);
    expect(fix(`{{ 'hello' | append: ' world`)).to.equal(`{{ 'hello' | append: ' world'}}`);
    expect(fix(`{{ "hello" | append: " world`)).to.equal(`{{ "hello" | append: " world"}}`);
    expect(fix(`{{ 'hello' | replace: 'hello', 'hi'`)).to.equal(
      `{{ 'hello' | replace: 'hello', 'hi'}}`,
    );
    expect(fix(`{{ "hello" | replace: "hello", "hi"`)).to.equal(
      `{{ "hello" | replace: "hello", "hi"}}`,
    );
  });

  it('appends a cursor character as a placeholder for variable lookups (to be used with completion mode parsing)', () => {
    const contexts = [
      `{{ █}}`,
      `{{ a.█}}`,
      `{{ a[█]}}`,
      `{{ a['█']}}`,
      `{{ a.b.█}}`,
      `{% echo █%}`,
      `{% echo a.█%}`,
      `{% echo a['█']%}`,
      `{% assign x = █%}`,
      `{% assign x = a.█%}`,
      `{% assign x = a['█']%}`,
      `{% for a in █%}`,
      `{% for a in b reversed limit: █%}`,
      `{% paginate b by █%}`,
      `{% paginate b by col, window_size: █%}`,
      `{% if █%}`,
      `{% if a > █%}`,
      `{% if a > b or █%}`,
      `{% if a > b or c > █%}`,
      `{% elsif a > █%}`,
      `{% when █%}`,
      `{% when a, █%}`,
      `{% cycle █%}`,
      `{% cycle 'foo', █%}`,
      `{% cycle 'foo': █%}`,
      `{% render 'snip', var: █%}`,
      `{% render 'snip' for █%}`,
      `{% render 'snip' with █%}`,
      `{% for x in (1..█)%}`,
      // `{% paginate █ by 50 %}`,
      `<a-{{ █}}>`,
      `<a data-{{ █}}>`,
      `<a data={{ █}}>`,
      `<a data="{{ █}}">`,
      `<a data='x{{ █}}'>`,
    ];
    for (const context of contexts) {
      expect(fix(context.replace(/█.*$/, ''))).to.equal(context);
    }
  });

  it('appends a cursor character as a placeholder for html element names (to be used with completion mode parsing)', () => {
    // prettier-ignore
    const contexts = [
      `<█>`,
      `</█>`,
    ];
    for (const context of contexts) {
      expect(fix(context.replace(/█.*$/, ''))).to.equal(context);
    }
  });

  it('appends a cursor character as a placeholder for html attribute names (to be used with completion mode parsing)', () => {
    // prettier-ignore
    const contexts = [
      `<a █>`,
      `<a attr="value" █>`,
      `<a {% if cond %}█>`,
      `<a {% if cond %}\n█>`,
    ];
    for (const context of contexts) {
      expect(fix(context.replace(/█.*$/, ''))).to.equal(context);
    }
  });

  it('appends a cursor character as a placeholder for html attribute values (to be used with completion mode parsing)', () => {
    // prettier-ignore
    const contexts = [
      `<a attr="█">`,
      `<a attr='█'>`,
    ];
    for (const context of contexts) {
      expect(fix(context.replace(/█.*$/, ''))).to.equal(context);
    }
  });

  describe('Case: the rest of the fucking owl', () => {
    it('fixes templates properly', () => {
      for (const { source, expected } of scenarios) {
        expect(fix(source), source).to.eql(expected);
      }
    });
  });
});
