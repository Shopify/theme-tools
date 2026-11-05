import { toTolerantLiquidAST, toTolerantLiquidHtmlAST } from '../tolerant';
import { describe, expect, it } from 'vitest';
import { toLiquidAST, toLiquidHtmlAST } from '../ast';
import { Environment, TagKind } from '../environment';
import { rawRaw } from '../tags/raw';
import { builtinTags } from '../tags/index';
import { TokenType, tokenize } from './tokenizer';

describe('raw-body token boundaries', () => {
  it.each([toLiquidHtmlAST, toLiquidAST])(
    'preserves text after a raw body ending in an opening brace',
    (parse) => {
      for (const [name, body] of [
        ['javascript', '// {{ 1 }}{'],
        ['javascript', '{'],
        ['stylesheet', 'a{'],
      ]) {
        const source = `{% ${name} %}${body}{% end${name} %}visible{{ 2 }}`;
        for (const [before, after] of [
          ['', ''],
          ['<p>', '</p>'],
        ]) {
          const ast = parse(before + source + after);
          const expected = [
            ...(parse === toLiquidAST && before ? [{ type: 'TextNode', value: before }] : []),
            { type: 'LiquidRawTag', body: { value: body } },
            { type: 'TextNode', value: 'visible' },
            { type: 'LiquidVariableOutput' },
            ...(parse === toLiquidAST && after ? [{ type: 'TextNode', value: after }] : []),
          ];
          expect(ast.children).toMatchObject(
            parse === toLiquidHtmlAST && before ? [{ children: expected }] : expected,
          );
        }
      }
    },
  );

  it.each([toLiquidHtmlAST, toLiquidAST])(
    'repairs a newly registered raw tag after bounded recovery in an enclosing body',
    (parse) => {
      const enclosures = [['{% javascript %}', '{% endjavascript %}']];
      if (parse === toLiquidHtmlAST) enclosures.push(['<script>', '</script>']);
      for (const [before, after] of enclosures) {
        const environment = new Environment({ ...builtinTags });
        environment.registerTag('change', {
          kind: TagKind.Tag,
          parse() {
            environment.registerTag('sealed', rawRaw);
            return undefined;
          },
        });
        const source =
          `${before}{% change %}{% raw %}{% endraw %}${after}` +
          '{% sealed %}{{ unfinished {% endsealed %}{{ 1 }}';
        expect(
          parse(source, { environment, mode: 'tolerant', allowUnclosedDocumentNode: false })
            .children,
        ).toMatchObject([
          { body: { nodes: expect.arrayContaining([expect.objectContaining({ name: 'raw' })]) } },
          { type: 'LiquidRawTag', name: 'sealed', body: { value: '{{ unfinished ' } },
          { type: 'LiquidVariableOutput', position: { end: source.length } },
        ]);
      }
    },
  );

  it.each(['<!-- --!>Visible -->', '<!-- a --!>b -->'])(
    'preserves text after an alternate comment close: %s',
    (source) => {
      const close = source.indexOf('--!>') + 4;
      expect(toLiquidHtmlAST(source).children).toMatchObject([
        { type: 'HtmlComment', position: { end: close } },
        { type: 'TextNode', value: source.slice(close) },
      ]);
    },
  );

  it.each([toLiquidHtmlAST, toLiquidAST])(
    "preserves a custom resolver's first lookup for a complete tag",
    (parse) => {
      const environment = new Environment({ ...builtinTags });
      let lookups = 0;
      environment.tagForName = () => (++lookups === 1 ? rawRaw : builtinTags.break);

      expect(
        parse('{% flip %}', {
          environment,
          allowUnclosedDocumentNode: false,
          mode: 'tolerant',
        }).children,
      ).toMatchObject([{ type: 'LiquidTag', name: 'flip' }]);
      expect(lookups).toBe(2);
    },
  );

  it.each(['<script>', '<style>', '<svg>'])(
    'keeps %s inside a raw body from changing later HTML context',
    (body) => {
      const ast = toLiquidHtmlAST(`{% raw %}${body}{% endraw %}<div>ok</div>`);
      expect(ast.children).toMatchObject([
        { type: 'LiquidRawTag', body: { value: body } },
        { type: 'HtmlElement', name: [{ value: 'div' }], children: [{ value: 'ok' }] },
      ]);
    },
  );

  describe.each(['raw', 'comment', 'doc'])('quoted HTML in %s bodies', (name) => {
    it.each([
      `<b class="{{ value }}" title='{{ "quoted" }}'>example</b>`,
      `<b class="{% if value %}yes{% else %}no{% endif %}">example</b>`,
      `{{ <b a=" }} <i a='{{ "quoted" }}'>example</i>`,
      `{{ <b a=' }} <i a="{{ 'quoted' }}">example</i>`,
      `<b a="{{ unfinished`,
      `<b a='{{ unfinished`,
      `<b a="unfinished`,
      `<b a=unfinished`,
      `<b {{ unfinished`,
      `<!-- <b a="unfinished`,
      `<!doctype html>`,
      `<{{ name }} a="value">`,
    ])("preserves the full scanner's context for %j", (body) => {
      for (const prefix of ['', 'text ', '<div>before</div>']) {
        const source = `${prefix}{% ${name} %}${body}{% end${name} %}<div>{{ 1 }}</div>`;
        const environment = new Environment({ ...builtinTags });
        let expected;
        try {
          expected = toLiquidHtmlAST(source, {
            environment,
            allowUnclosedDocumentNode: false,
            mode: 'tolerant',
          });
        } catch {
          expect(() => toLiquidHtmlAST(source)).toThrow();
          continue;
        }
        expect(toLiquidHtmlAST(source)).toEqual(expected);
      }
    });
  });

  it('preserves parsed siblings when recovery begins inside a later raw block', () => {
    const prefix = "<script>const x = '<b></b>';</script>{% raw %}clean{% endraw %}{{ 1 }}";
    const section = '{% raw %}{{ unfinished {% endraw %}{{ 2 }}';
    const source = prefix + section.repeat(3);
    const ast = toLiquidHtmlAST(source);

    expect(ast.children.map((node) => node.type)).toEqual([
      'HtmlRawNode',
      'LiquidRawTag',
      'LiquidVariableOutput',
      ...Array.from({ length: 3 }, () => ['LiquidRawTag', 'LiquidVariableOutput']).flat(),
    ]);
    expect(ast.children[3].position.start).toBe(prefix.length);
    expect(ast.children[8].position.end).toBe(source.length);
  });

  it.each(['"', "'", ''])('preserves %j attribute context across recovery', (quote) => {
    const raw = '{% raw %}{{ unfinished {% endraw %}';
    const source = `<div data-x=${quote}a${raw}b${quote}>{{ 1 }}</div>${raw}{{ 2 }}`;
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toMatchObject([
      { type: 'HtmlElement', children: [{ type: 'LiquidVariableOutput' }] },
      { type: 'LiquidRawTag', body: { value: '{{ unfinished ' } },
      { type: 'LiquidVariableOutput', position: { end: source.length } },
    ]);
  });

  it('recovers after an unfinished documentation example without restarting frontmatter', () => {
    const source =
      "{% doc %}\n@example\n{% render 'example' }\n{% enddoc %}" +
      '---\ntitle: example\n---\n<script>a<b</script>' +
      "<!-- {% raw %}ignored{% endraw %} -->{{ '{% endraw %}' }}";
    const ast = toLiquidHtmlAST(source);

    expect(ast.children.map((node) => node.type)).toEqual([
      'LiquidRawTag',
      'TextNode',
      'HtmlRawNode',
      'HtmlComment',
      'LiquidVariableOutput',
    ]);
    expect(ast.children[1]).toMatchObject({ value: '---\ntitle: example\n---' });
    expect(ast.children[4].position.end).toBe(source.length);
  });

  it.each([toLiquidAST, toLiquidHtmlAST])(
    'keeps a sibling boundary after an enclosing lexical limit',
    (parse) => {
      const source = '{% javascript %}{%%}{% endjavascript %}{% raw %}{{%endraw%}<\n';
      expect(parse(source).children).toMatchObject([
        { type: 'LiquidRawTag', name: 'javascript' },
        { type: 'LiquidRawTag', name: 'raw', body: { value: '{' } },
        { type: 'TextNode', value: '<' },
      ]);
    },
  );

  it('keeps different raw tags bounded after an unresolved inner opener', () => {
    const source = '{%javascript %}{%javascript%}{%raw%}{{%endraw%}<{%endjavascript%}';
    const ast = toLiquidAST(source);
    expect(ast.children[0]).toMatchObject({
      body: {
        nodes: [
          {
            type: 'LiquidRawTag',
            name: 'javascript',
            body: {
              nodes: [
                { type: 'LiquidRawTag', name: 'raw', body: { value: '{' } },
                { type: 'TextNode', value: '<' },
              ],
            },
          },
        ],
      },
    });
  });

  it.each(['svg', 'script', 'style'])(
    'repairs a raw tag registered inside %s before locating its close',
    (name) => {
      const environment = new Environment({ ...builtinTags });
      environment.registerTag('change', {
        kind: TagKind.Tag,
        parse() {
          environment.registerTag('sealed', rawRaw);
          return undefined;
        },
      });
      const source = `<${name}>{% change %}{% sealed %}<b a="{% endsealed %}{{ 1 }}</${name}>{{ 2 }}`;
      expect(
        toLiquidHtmlAST(source, {
          environment,
          allowUnclosedDocumentNode: false,
          mode: 'tolerant',
        }).children,
      ).toMatchObject([
        {
          type: 'HtmlRawNode',
          body: {
            nodes: expect.arrayContaining([
              expect.objectContaining({ type: 'LiquidRawTag', name: 'sealed' }),
              expect.objectContaining({ type: 'LiquidVariableOutput' }),
            ]),
          },
        },
        { type: 'LiquidVariableOutput', position: { end: source.length } },
      ]);
    },
  );

  it('keeps custom callbacks from changing how an already parsed prefix is tokenized', () => {
    const env = new Environment({ raw: rawRaw });
    env.registerTag('earlier', { kind: TagKind.Tag, parse: () => undefined });
    env.registerTag('change', {
      kind: TagKind.Tag,
      parse: () => {
        env.registerTag('earlier', rawRaw);
        return undefined;
      },
    });
    const source = '{% earlier %}{% change %}{% raw %}{{ unfinished {% endraw %}{{ 1 }}';
    const ast = toLiquidHtmlAST(source, {
      environment: env,
      allowUnclosedDocumentNode: false,
      mode: 'tolerant',
    });

    expect(ast.children).toMatchObject([
      { type: 'LiquidTag', name: 'earlier' },
      { type: 'LiquidTag', name: 'change' },
      { type: 'LiquidRawTag', body: { value: '{{ unfinished ' } },
      { type: 'LiquidVariableOutput', position: { end: source.length } },
    ]);
  });

  describe.each([
    ['Liquid', toLiquidAST],
    ['HTML', toLiquidHtmlAST],
  ] as const)('%s after callback registration', (_name, parse) => {
    const options = { allowUnclosedDocumentNode: false, mode: 'tolerant' } as const;

    it('preserves output when re-registering a changed definition object', () => {
      const env = new Environment({ ...builtinTags });
      const definition = { ...rawRaw, body: { ...rawRaw.body } };
      definition.body.delimiter = 'leading';
      env.registerTag('sealed', definition);
      env.registerTag('change', {
        kind: TagKind.Tag,
        parse() {
          definition.body.delimiter = 'trailing';
          env.registerTag('sealed', definition);
          return undefined;
        },
      });
      const source = '{% change %}{% sealed %}{{ unfinished {% endsealed %}{{ 1 }}';
      expect(parse(source, { ...options, environment: env }).children).toMatchObject([
        { type: 'LiquidTag', name: 'change' },
        { type: 'LiquidRawTag', body: { value: '{{ unfinished ' } },
        { type: 'LiquidVariableOutput', position: { end: source.length } },
      ]);
    });

    function environment() {
      const env = new Environment({ ...builtinTags });
      env.registerTag('sealed', { kind: TagKind.Tag, parse: () => undefined });
      env.registerTag('change', {
        kind: TagKind.Tag,
        parse: () => {
          env.registerTag('sealed', rawRaw);
          return undefined;
        },
      });
      return env;
    }

    it.each(['{{ unfinished ', '{% unfinished ', '<script>'])(
      'preserves output after %j',
      (body) => {
        const source = `{% change %}{% sealed %}${body}{% endsealed %}{{ 1 }}`;
        const ast = parse(source, { ...options, environment: environment() });

        expect(ast.children).toMatchObject([
          { type: 'LiquidTag', name: 'change' },
          { type: 'LiquidRawTag', name: 'sealed', body: { value: body } },
          { type: 'LiquidVariableOutput', position: { end: source.length } },
        ]);
        expect(ast.children).toHaveLength(3);
      },
    );

    it.each(['"', "'", ''])('preserves %j attribute context', (quote) => {
      const source =
        `{% change %}<div data-x=${quote}a{% sealed %}{{ unfinished {% endsealed %}` +
        `b${quote}>{{ 1 }}</div>`;
      const ast = parse(source, { ...options, environment: environment() });
      const registered = environment();
      registered.registerTag('sealed', rawRaw);

      expect(ast).toEqual(parse(source, { ...options, environment: registered }));
      expect(
        ast.children.some(
          (node) => node.type === 'LiquidVariableOutput' || node.type === 'HtmlElement',
        ),
      ).toBe(true);
    });

    it.each([
      ['document', '<div>', '</div>'],
      ['double-quoted attribute', '<div data-x="', '">ok</div>'],
      ['single-quoted attribute', "<div data-x='", "'>ok</div>"],
      ['unquoted attribute', '<div data-x=', '>ok</div>'],
      ['script', '<script>', '</script>{{ 2 }}'],
      ['style', '<style>', '</style>{{ 2 }}'],
      ['SVG', '<svg>', '</svg>{{ 2 }}'],
      ['Liquid body', '{% javascript %}', '{% endjavascript %}{{ 2 }}'],
    ])('preserves parsed definitions in a %s', (_name, before, after) => {
      function registered(redefineEarlier: boolean, parseLiquidInBody: boolean) {
        const env = environment();
        const definition = { ...rawRaw, parseLiquidInBody };
        if (!redefineEarlier) env.registerTag('sealed', definition);
        env.registerTag('earlier', { kind: TagKind.Tag, parse: () => undefined });
        env.registerTag('change', {
          kind: TagKind.Tag,
          parse: () => {
            if (redefineEarlier) env.registerTag('earlier', rawRaw);
            env.registerTag('sealed', definition);
            return undefined;
          },
        });
        return env;
      }
      const source =
        `${before}{% earlier %}{% change %}{% sealed %}{{ unfinished ` +
        `{% endsealed %}{{ 1 }}${after}`;

      for (const parseLiquidInBody of [false, true]) {
        expect(
          parse(source, { ...options, environment: registered(true, parseLiquidInBody) }),
        ).toEqual(parse(source, { ...options, environment: registered(false, parseLiquidInBody) }));
      }
    });

    it('keeps a trim delimiter after the raw body as attribute text', () => {
      const source =
        '{% change %}<div data-x="{% sealed %}{{ unfinished {% endsealed %}-}}">{{ 1 }}</div>';
      const registered = environment();
      registered.registerTag('sealed', rawRaw);

      expect(parse(source, { ...options, environment: environment() })).toEqual(
        parse(source, { ...options, environment: registered }),
      );
    });
  });

  it.each([
    ['{% raw %}{{ unfinished {% endraw %}{{ 1 }}', 'LiquidRawTag', '{{ unfinished '],
    ['<script>const value = 1;</script>{{ 1 }}', 'HtmlRawNode', 'const value = 1;'],
  ])('keeps repeated raw bodies and following output separate: %s', (section, type, value) => {
    const source = section.repeat(600);
    const ast = toLiquidHtmlAST(source);
    const outputStart = section.indexOf('{{ 1 }}');

    expect(ast.children).toHaveLength(1200);
    expect(ast.children[0]).toMatchObject({
      type,
      body: { value },
      position: { start: 0, end: outputStart },
    });
    expect(ast.children[1]).toMatchObject({
      type: 'LiquidVariableOutput',
      position: { start: outputStart, end: section.length },
    });
    expect(ast.children[1199].position.end).toBe(source.length);
  });

  it.each(['', '{', '<', '{{', '{%', '{{-', '{%-'])(
    'keeps a raw body ending in %j from consuming its closing delimiter',
    (body) => {
      const source = `{% raw %}${body}{%- endraw -%}{{ 1 }}`;
      const ast = toLiquidHtmlAST(source);

      expect(ast.children).toHaveLength(2);
      expect(ast.children[0]).toMatchObject({ type: 'LiquidRawTag', body: { value: body } });
      expect(ast.children[1]).toMatchObject({
        type: 'LiquidVariableOutput',
        position: { start: source.indexOf('{{ 1 }}'), end: source.length },
      });
    },
  );

  it('restores enclosing and document boundaries after nested and empty raw bodies', () => {
    const source =
      '{% javascript %}{% raw %}{{ unfinished {% endraw %}{{ inner }}' +
      '{% raw %}{% endraw %}{% endjavascript %}{{ sibling }}';
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toHaveLength(2);
    expect(ast.children[0]).toMatchObject({
      type: 'LiquidRawTag',
      name: 'javascript',
      body: {
        nodes: [
          { type: 'LiquidRawTag', name: 'raw', body: { value: '{{ unfinished ' } },
          { type: 'LiquidVariableOutput' },
          { type: 'LiquidRawTag', name: 'raw', body: { value: '' } },
        ],
      },
    });
    expect(ast.children[1]).toMatchObject({
      type: 'LiquidVariableOutput',
      position: { start: source.indexOf('{{ sibling }}'), end: source.length },
    });
  });

  it('retains raw boundaries and suppresses frontmatter after HTML raw-text recovery', () => {
    const source =
      '<script>if(a<b){}</script>{% raw %}{{ unfinished {% endraw %}' +
      '---\ntitle: example\n---\n{{ 1 }}';
    const ast = toLiquidHtmlAST(source);

    expect(ast.children.map((node) => node.type)).toEqual([
      'HtmlRawNode',
      'LiquidRawTag',
      'TextNode',
      'LiquidVariableOutput',
    ]);
    expect(ast.children[1]).toMatchObject({ body: { value: '{{ unfinished ' } });
    expect(ast.children[2]).toMatchObject({ value: '---\ntitle: example\n---' });
    expect(ast.children[3].position.end).toBe(source.length);
  });

  describe.each(['script', 'style', 'SCRIPT', 'STYLE'])('after a %s raw-text close', (name) => {
    it.each(['a<b', 'a<!b', "a<b'", 'a<b"'])(
      'preserves a following HTML comment and output after %j',
      (body) => {
        const element = `<${name}>${body}</${name} \n>`;
        const comment = '<!-- {% raw %}ignored{% endraw %} -->';
        const output = "{{ '{% endraw %}' }}";
        const source = element + comment + output;
        const ast = toLiquidHtmlAST(source);

        expect(ast.children).toMatchObject([
          {
            type: 'HtmlRawNode',
            body: { value: body },
            position: { start: 0, end: element.length },
          },
          {
            type: 'HtmlComment',
            position: { start: element.length, end: element.length + comment.length },
          },
          {
            type: 'LiquidVariableOutput',
            position: { start: element.length + comment.length, end: source.length },
          },
        ]);
      },
    );

    it.each([
      ['<!-- {% raw %}ignored{% endraw %} -->', 'HtmlComment'],
      ['<!doctype {% raw %}>', 'HtmlDoctype'],
    ])('preserves following %s', (opaque, type) => {
      const source = `<${name}>a<b</${name}>${opaque}{{ '{% endraw %}' }}`;

      expect(toLiquidHtmlAST(source).children).toMatchObject([
        { type: 'HtmlRawNode' },
        { type },
        { type: 'LiquidVariableOutput', position: { end: source.length } },
      ]);
    });
  });

  it.each(['script', 'style'])('bounds work for repeated %s bodies with < comparisons', (name) => {
    const section = `<${name}>a<b</${name}><!-- {% raw %}ignored{% endraw %} -->{{ '{% endraw %}' }}`;
    const source = section.repeat(3_000);
    const started = performance.now();
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toHaveLength(9_000);
    expect(ast.children[8_999].position.end).toBe(source.length);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('bounds raw tags inside doctype-like text in a Liquid-only parse', () => {
    const source = '<!doctype {% raw %}>{{ unfinished {% endraw %}{{ 1 }}';

    expect(toLiquidAST(source).children).toMatchObject([
      { type: 'TextNode', value: '<!doctype' },
      { type: 'LiquidRawTag', name: 'raw' },
      { type: 'LiquidVariableOutput', position: { end: source.length } },
    ]);
  });

  it('keeps repeated HTML comments as independent nodes', () => {
    const section = '<!-- comment -->';
    const ast = toLiquidHtmlAST(section.repeat(1500));

    expect(ast.children).toHaveLength(1500);
    expect(ast.children[0].position).toEqual({ start: 0, end: section.length });
    expect(ast.children[1499].position.end).toBe(section.length * 1500);
  });

  it.each([
    ['<!-- {% raw %}ignored{% endraw %} -->', 'HtmlComment'],
    ['<!-- <!doctype html> {% raw %}ignored{% endraw %} -->', 'HtmlComment'],
    ['<!doctype {% raw %}>', 'HtmlDoctype'],
  ])('preserves following output after %s', (opaque, type) => {
    const source = opaque + "{{ 'text {% endraw %} text' }}";

    expect(toLiquidHtmlAST(source).children).toMatchObject([
      { type },
      { type: 'LiquidVariableOutput', position: { end: source.length } },
    ]);
  });

  it.each(['', '<script>a<b</script>', '<style>a<b</style>'])(
    'finds a real raw tag after a commented opener following %j',
    (prefix) => {
      const source =
        prefix +
        '<!-- {% raw %}ignored{% endraw %} -->{% javascript %}{{ unfinished {% endjavascript %}{{ 1 }}';
      const children = toLiquidHtmlAST(source).children;

      expect(children.slice(prefix ? 1 : 0)).toMatchObject([
        { type: 'HtmlComment' },
        { type: 'LiquidRawTag', name: 'javascript', body: { value: '{{ unfinished ' } },
        { type: 'LiquidVariableOutput', position: { end: source.length } },
      ]);
    },
  );

  it('still parses Liquid tags inside an HTML-looking comment in Liquid-only mode', () => {
    const source = '<!-- {% raw %} -->{% endraw %}';
    const ast = toLiquidAST(source);

    expect(ast.children.some((node) => node.type === 'LiquidRawTag')).toBe(true);
  });

  it('parses Liquid inside an HTML-looking comment in a script body', () => {
    const source = '<script><!-- {% javascript %}{{ unfinished {% endjavascript %} --></script>';
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({ type: 'HtmlRawNode' });
  });

  it.each(['script', 'style', 'svg'])(
    'preserves output in a %s raw element with glued conditional attributes',
    (name) => {
      const source =
        `<${name}{% if x %} type="module"{% endif %}>` +
        '<!-- {% raw %}{{ unfinished {% endraw %}{{ 1 }}' +
        `</${name}>`;
      const ast = toLiquidHtmlAST(source);
      const outputStart = source.indexOf('{{ 1 }}');

      expect(ast.children).toHaveLength(1);
      expect(ast.children[0]).toMatchObject({
        type: 'HtmlRawNode',
        body: {
          nodes: expect.arrayContaining([
            expect.objectContaining({
              type: 'LiquidVariableOutput',
              position: { start: outputStart, end: outputStart + '{{ 1 }}'.length },
            }),
          ]),
        },
      });
    },
  );

  it('recognizes a raw HTML tag after a text token', () => {
    const source = 'before<script><!-- {% raw %}{{ unfinished {% endraw %}{{ 1 }}</script>';
    const ast = toLiquidHtmlAST(source);
    const outputStart = source.indexOf('{{ 1 }}');

    expect(ast.children).toHaveLength(2);
    expect(ast.children[1]).toMatchObject({
      type: 'HtmlRawNode',
      body: {
        nodes: expect.arrayContaining([
          expect.objectContaining({
            type: 'LiquidVariableOutput',
            position: { start: outputStart, end: outputStart + '{{ 1 }}'.length },
          }),
        ]),
      },
    });
  });

  it.each(['svg-icon', 'script-widget', 'style-card'])(
    'parses comments in the ordinary %s element and after it',
    (name) => {
      const output = "{{ 'text {% endraw %} text' }}";
      const source = `<${name}><!-- {% raw %}ignored{% endraw %} -->${output}</${name}><!-- {% raw %}ignored{% endraw %} -->${output}`;
      const ast = toLiquidHtmlAST(source);

      expect(ast.children).toHaveLength(3);
      expect(ast.children[0]).toMatchObject({ type: 'HtmlElement' });
      expect(ast.children[1]).toMatchObject({ type: 'HtmlComment' });
      expect(ast.children[2]).toMatchObject({ type: 'LiquidVariableOutput' });
      expect(ast.children[2].position.end).toBe(source.length);
    },
  );

  it.each(['raw', 'comment'])('bounds work for repeated unclosed %s tags', (tagName) => {
    const source = `{% ${tagName} %}`.repeat(8_000);
    const started = performance.now();

    tokenize(source, { rawTags: Environment.default(), parseHtml: true });

    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('bounds work for raw tags in repeated HTML comments', () => {
    const source = '<!-- {% raw %}ignored{% endraw %} -->'.repeat(8_000);
    const started = performance.now();
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toHaveLength(8_000);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  it('bounds work when repeated inner raw tags close beyond their enclosing body', () => {
    const source =
      '{% javascript %}' + '{% raw %}'.repeat(8_000) + '{% endjavascript %}{% endraw %}';
    const started = performance.now();

    tokenize(source, { rawTags: Environment.default(), parseHtml: true });

    expect(performance.now() - started).toBeLessThan(1_000);
  });

  // The tokenizer-only checks above don't run the parser, which is where an
  // unclosed raw opener searches for its close.
  describe.each([
    ['repeated unclosed raw tags', '{% raw %}'.repeat(8_000)],
    ['repeated unclosed comment tags', '{% comment %}'.repeat(8_000)],
    [
      'repeated inner raw tags closing beyond their enclosing body',
      '{% javascript %}' + '{% raw %}'.repeat(8_000) + '{% endjavascript %}{% endraw %}',
    ],
  ])('bounds parser work for %s', (_name, source) => {
    it.each([
      ['toLiquidHtmlAST', toLiquidHtmlAST],
      ['toLiquidAST', toLiquidAST],
    ] as const)('in %s', (_entry, parse) => {
      const started = performance.now();

      expect(() => parse(source)).toThrow();
      expect(performance.now() - started).toBeLessThan(1_000);
    });
  });

  it('still finds a sibling raw boundary after rejected inner boundaries', () => {
    const source =
      "{% javascript %}{% raw %}{% endjavascript %}<!-- {{ '{% endraw %}' }} -->" +
      '{% raw %}{{ unfinished {% endraw %}{{ 1 }}';
    const ast = toLiquidHtmlAST(source);

    expect(ast.children[0]).toMatchObject({ type: 'LiquidRawTag', name: 'javascript' });
    expect(ast.children[1]).toMatchObject({ type: 'HtmlComment' });
    expect(ast.children[2]).toMatchObject({
      type: 'LiquidRawTag',
      name: 'raw',
      body: { value: '{{ unfinished ' },
    });
    expect(ast.children[3]).toMatchObject({ type: 'LiquidVariableOutput' });
  });

  it('preserves a quoted HTML attribute around an unfinished raw body opener', () => {
    const source = '<div data-x="a{% raw %}{{ unfinished {% endraw %}b">ok</div>';
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({ type: 'HtmlElement' });
    expect(ast.children[0].position.end).toBe(source.length);

    const tokens = tokenize(source, { rawTags: Environment.default() });

    expect(tokens.some((token) => token.type === TokenType.HtmlQuoteClose)).toBe(true);
    expect(tokens.some((token) => token.type === TokenType.HtmlTagClose)).toBe(true);
  });

  it('preserves an unquoted HTML attribute list around a raw block', () => {
    const source = '<div {% raw %}{{ unfinished {% endraw %}class="x">ok</div>';
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toHaveLength(1);
    expect(ast.children[0]).toMatchObject({ type: 'HtmlElement' });
    expect(ast.children[0].position.end).toBe(source.length);
  });

  it('does not treat mid-document dashes after a raw tag as frontmatter', () => {
    const source = '{% raw %}{{ unfinished {% endraw %}---\ntitle: example\n---\n';
    const tokens = tokenize(source, { rawTags: Environment.default() });

    expect(tokens.some((token) => token.type === TokenType.YamlFrontmatter)).toBe(false);
    expect(tokens[tokens.length - 1].start).toBe(source.length);
  });

  it.each(['<!-- closed -->', '<!-- unfinished'])(
    'preserves existing HTML context after a literal raw body before %j',
    (suffix) => {
      const source = '{% raw %}<b{% endraw %}' + suffix + '{{ 1 }}';
      expect(toLiquidHtmlAST(source).children).toMatchObject([
        { type: 'LiquidRawTag', body: { value: '<b' } },
        suffix.endsWith('-->')
          ? { type: 'HtmlComment', body: 'closed' }
          : {
              type: 'HtmlComment',
              children: expect.arrayContaining([
                expect.objectContaining({
                  type: 'LiquidVariableOutput',
                  position: { end: source.length, start: source.indexOf('{{ 1 }}') },
                }),
              ]),
            },
        ...(suffix.endsWith('-->')
          ? [{ type: 'LiquidVariableOutput', position: { end: source.length } }]
          : []),
      ]);
    },
  );

  it.each(['script', 'style', 'svg'])(
    'preserves literal raw bodies containing an HTML %s opener',
    (name) => {
      const source = `{% raw %}<${name}>{% endraw %}<div>ok</div>{{ 1 }}`;

      expect(toLiquidHtmlAST(source).children).toMatchObject([
        { type: 'LiquidRawTag', body: { value: `<${name}>` } },
        { type: 'HtmlElement' },
        { type: 'LiquidVariableOutput', position: { end: source.length } },
      ]);
    },
  );

  it("preserves an enclosing raw body's context when repairing a nested literal body", () => {
    const source =
      '{% javascript %}{% raw %}{{ {% endraw %}<script> }}{% endjavascript %}<div>ok</div>';
    const ast = toLiquidHtmlAST(source);

    expect(ast.children).toMatchObject([
      { type: 'LiquidRawTag', name: 'javascript' },
      {
        type: 'HtmlElement',
        name: [{ type: 'TextNode', value: 'div' }],
        position: { end: source.length },
      },
    ]);
  });

  it.each(['}}', '-}}'])('keeps %j after an unfinished literal output as text', (suffix) => {
    const source = '{% raw %}{{ {% endraw %}' + suffix;

    expect(toLiquidHtmlAST(source).children).toMatchObject([
      { type: 'LiquidRawTag', body: { value: '{{ ' } },
      { type: 'TextNode', value: suffix, position: { end: source.length } },
    ]);
  });

  it('tokenizes deeply nested Liquid-bearing raw bodies without recursive lexer calls', () => {
    const env = customRawEnvironment();
    env.registerTag('sealed', {
      ...rawRaw,
      kind: TagKind.Raw,
      parseLiquidInBody: true,
      body: { delimiter: 'leading', sameName: 'nests', opaque: [], closesInLiquidTag: false },
    });
    const source = '{% sealed %}'.repeat(2_000) + '{% endsealed %}'.repeat(2_000);
    const tokens = tokenize(source, { rawTags: env });

    expect(tokens).toHaveLength(12_001);
    expect(tokens[tokens.length - 1]).toEqual({
      type: TokenType.EndOfInput,
      start: source.length,
      end: source.length,
    });
  });

  it('recovers HTML raw text after successive callbacks change the raw-tag registry', () => {
    const env = new Environment();
    let count = 0;
    env.registerTag('change', {
      kind: TagKind.Tag,
      parse: () => {
        env.registerTag(`sealed${++count}`, rawRaw);
        return undefined;
      },
    });
    const source =
      [1, 2]
        .map((n) => `{% change %}<script>{% sealed${n} %}</script>{% endsealed${n} %}a<b</script>`)
        .join('') + '{{ 1 }}';
    const ast = toLiquidHtmlAST(source, {
      environment: env,
      mode: 'strict',
      allowUnclosedDocumentNode: false,
    });

    expect(ast.children).toMatchObject([
      { type: 'LiquidTag', name: 'change' },
      { type: 'HtmlRawNode', body: { value: '{% sealed1 %}</script>{% endsealed1 %}a<b' } },
      { type: 'LiquidTag', name: 'change' },
      { type: 'HtmlRawNode', body: { value: '{% sealed2 %}</script>{% endsealed2 %}a<b' } },
      { type: 'LiquidVariableOutput', position: { end: source.length } },
    ]);
  });

  it('uses custom raw body rules in both the tokenizer and parser', () => {
    const env = customRawEnvironment();

    const source = '{% sealed %}a{% sealed %}x{% endsealed %}y{% endsealed %}{{ 1 }}';
    const ast = toLiquidHtmlAST(source, {
      environment: env,
      allowUnclosedDocumentNode: false,
      mode: 'tolerant',
    });

    expect(ast.children).toHaveLength(2);
    expect(ast.children[0]).toMatchObject({
      type: 'LiquidRawTag',
      body: { value: 'a{% sealed %}x{% endsealed %}y' },
    });
    expect(ast.children[1]).toMatchObject({ type: 'LiquidVariableOutput' });
    expect(ast.children[1].position.end).toBe(source.length);
  });

  it.each(['script', 'style'])('shields the %s close inside a custom raw body', (name) => {
    const env = customRawEnvironment();

    const body = `a<b{% sealed %}</${name}>{{ ignored }}{% endsealed %}after`;
    const source = `<${name}>${body}</${name}><!-- {% sealed %}ignored{% endsealed %} -->{{ '{% endsealed %}' }}`;
    const ast = toLiquidHtmlAST(source, {
      environment: env,
      mode: 'strict',
      allowUnclosedDocumentNode: false,
    });

    expect(ast.children).toMatchObject([
      { type: 'HtmlRawNode', body: { value: body } },
      { type: 'HtmlComment' },
      { type: 'LiquidVariableOutput', position: { end: source.length } },
    ]);
  });
});

function customRawEnvironment(): Environment {
  const env = new Environment();
  env.registerTag('sealed', {
    ...rawRaw,
    kind: TagKind.Raw,
    body: { delimiter: 'leading', sameName: 'nests', opaque: [], closesInLiquidTag: false },
  });
  return env;
}

describe.each([toTolerantLiquidAST, toTolerantLiquidHtmlAST])(
  'tolerant raw boundaries',
  (parse) => {
    it.each(['{{ unfinished ', '{% unfinished ', '<b a="unfinished'])(
      'keeps following output after %j',
      (body) => {
        const source = `{% raw %}${body}{% endraw %}{{ value }}`;
        expect(parse(source).children).toMatchObject([
          { type: 'LiquidRawTag', body: { value: body } },
          { type: 'LiquidVariableOutput', position: { end: source.length } },
        ]);
      },
    );

    it('repairs boundaries after a parser callback registers a raw tag', () => {
      const environment = new Environment({ ...builtinTags });
      environment.registerTag('change', {
        kind: TagKind.Tag,
        parse() {
          environment.registerTag('sealed', rawRaw);
        },
      });
      const source = '{% change %}{% sealed %}{{ unfinished {% endsealed %}{{ value }}';
      expect(
        parse(source, { environment, mode: 'tolerant', allowUnclosedDocumentNode: true }).children,
      ).toMatchObject([
        { type: 'LiquidTag', name: 'change' },
        { type: 'LiquidRawTag', name: 'sealed', body: { value: '{{ unfinished ' } },
        { type: 'LiquidVariableOutput', position: { end: source.length } },
      ]);
    });

    it('closes a nested comment inside an unclosed one', () => {
      const source = '{% comment %}a{% comment %}b{% endcomment %}c';
      expect(parse(source).children).toMatchObject([
        { type: 'LiquidErrorNode', position: { start: 0, end: 14 } },
        { type: 'LiquidRawTag', name: 'comment', body: { value: 'b' } },
        { type: 'TextNode', value: 'c' },
      ]);
    });

    it('closes the innermost open comments a later search reaches', () => {
      const source = '{% comment %}{% comment %}{% comment %}a{% endcomment %}b{% endcomment %}';
      expect(parse(source).children).toMatchObject([
        { type: 'LiquidErrorNode', position: { start: 0, end: 13 } },
        {
          type: 'LiquidRawTag',
          name: 'comment',
          body: { value: '{% comment %}a{% endcomment %}b' },
          position: { end: source.length },
        },
      ]);
    });

    it.each([
      ['unclosed raw tags', '{% raw %}'.repeat(8_000)],
      ['unclosed comment tags', '{% comment %}'.repeat(8_000)],
      ['comment tags with one close', '{% comment %}'.repeat(8_000) + '{% endcomment %}'],
    ])('bounds work for repeated %s', (_name, source) => {
      const started = performance.now();

      parse(source);

      expect(performance.now() - started).toBeLessThan(1_000);
    });
  },
);
