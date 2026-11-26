import { describe, expect, it } from 'vitest';
import * as prettier from 'prettier';
import plugin from './plugin';

// Prettier 2 formats synchronously and Prettier 3 returns a promise.
async function format(source: string) {
  return prettier.format(source, { parser: 'liquid-html', plugins: [plugin as any] });
}

describe('parse', () => {
  describe('rejects a template instead of writing a different one', () => {
    it.each([
      // https://github.com/Shopify/theme-tools/issues/1382
      ['a Liquid end tag inside a start tag', '{% capture a %}<svg h="1"{% endcapture %}\nx'],
      ['a Liquid end tag glued to a tag name', '{% capture a %}<svg{% endcapture %}\nx'],
      [
        'a Liquid end tag inside a start tag, inside an element',
        '<main>{% capture a %}<svg h="1"{% endcapture %}x</main>',
      ],
      ['an unclosed if', '{% if a %}x'],
      ['an unclosed if with no body', '{% if a %}'],
      ['an unclosed unless', '{% unless a %}x'],
      ['an unclosed for', '{% for x in y %}<li>{{ x }}'],
      ['an unclosed comment tag', '{% comment %}x'],
      ['an unclosed raw tag', '{% raw %}x'],
      ['an unclosed element', '<div>x'],
      ['an unclosed script', '<script>x'],
      ['an element closed only inside an if', '<div>{% if a %}</div>{% endif %}'],
      [
        'an element opened in each branch and closed after the if',
        '{% if a %}<div class="x">{% else %}<div class="y">{% endif %}z</div>',
      ],
      ['a close tag with no open tag', '</div>'],
      ['a close tag for another element', '<div></span></div>'],
      ['a Liquid end tag with no open tag', '{% endif %}'],
      ['an unclosed Liquid output', '{{ x'],
      ['an unclosed attribute value', '<a href="{{ url }}'],
    ])('%s', async (_name, source) => {
      await expect(format(source)).rejects.toThrow();
    });
  });

  describe('formats a template the parser reads completely', () => {
    it.each([
      ['recovered filter arguments', "{{ x | split: '', }}", "{{ x | split: '' }}\n"],
      [
        'an element opened and closed in matching ifs',
        '{% if a %}<div>{% endif %}x{% if a %}</div>{% endif %}',
        '{% if a %}<div>{% endif %}x{% if a %}</div>{% endif %}\n',
      ],
      ['an unclosed HTML comment, which ends the document', '<!-- x', '<!-- x\n'],
    ])('%s', async (_name, source, expected) => {
      expect(await format(source)).toBe(expected);
    });
  });
});
