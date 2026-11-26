import { describe, expect, it } from 'vitest';
import * as prettier from 'prettier';
import plugin from './plugin';

// Prettier 2 formats synchronously and Prettier 3 returns a promise.
async function format(source: string) {
  return prettier.format(source, { parser: 'liquid-html', plugins: [plugin as any] });
}

describe('parse', () => {
  it.each([
    '{% capture a %}<svg h="1"{% endcapture %}\nx',
    '<main>{% capture a %}<svg h="1"{% endcapture %}x</main>',
  ])('rejects a template that does not parse instead of rewriting it: %s', async (source) => {
    await expect(format(source)).rejects.toThrow(
      "Attempting to close LiquidTag 'capture' before it was opened",
    );
  });

  it('still formats markup that parses with recovery', async () => {
    expect(await format("{{ 'key' | t: }}")).toBe("{{ 'key' | t }}\n");
  });
});
