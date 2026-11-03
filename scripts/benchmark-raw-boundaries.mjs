import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { build } from 'vite';
import { THEME_FILES } from '../packages/liquid-html-parser/fixtures/theme-bundle.ts';

const script = fileURLToPath(import.meta.url);
const root = resolve(dirname(script), '..');
process.chdir(root);
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const scenarios = {
  unfinishedRaw: '{% raw %}{{ unfinished {% endraw %}{{ 1 }}',
  validRaw: '{% raw %}ordinary raw body {{ ignored }}{% endraw %}{{ 1 }}',
  script: '<script>a < b</script><!-- {% raw %}ignored{% endraw %} -->{{ value }}',
  comments: '<!-- ordinary storefront comment -->',
  html: '<div class="card">{{ product.title }}</div>',
  text: 'Ordinary storefront text with no special delimiters. ',
};

function sourcesFor(label, size) {
  const output = `{{ ${'x'.repeat(size * 256)} }}`;
  if (label === 'tokenizer/output') return [`${output}{{ value }}`];
  if (label === 'tokenizer/quoted') return [`${output} rest" >`];
  if (label === 'tokenizer/tag') return [`${output} >`];
  if (label === 'textBeforeHtml') return [`${'x'.repeat(size * 256)}<div>ok</div>`];
  if (label === 'quotedText') return [`<div x="${'x'.repeat(size * 256)}"></div>`];
  if (label === 'quotedOutputs') return [`<div x="${'text {{ value }}'.repeat(size)}"></div>`];
  if (!label.startsWith('theme/')) return [scenarios[label].repeat(size)];
  return THEME_FILES.filter((file) => file.path.startsWith(label.slice(6) + '/')).map(
    (file) => file.source,
  );
}

function parserFor(parser, label) {
  if (!label.startsWith('tokenizer/')) return parser.toLiquidHtmlAST;
  const options = {
    rawBodyRule(name) {
      const tag = Object.hasOwn(parser.builtinTags, name) ? parser.builtinTags[name] : undefined;
      return tag?.kind === 'raw' ? tag.body : undefined;
    },
    parseHtml: true,
    insideQuotedAttribute: label === 'tokenizer/quoted' ? '"' : undefined,
    insideHtmlTag: label === 'tokenizer/tag',
  };
  return (source) => parser.tokenize(source, options);
}

if (process.argv[2] === '--worker') {
  const { bundle, label, size } = JSON.parse(process.argv[3]);
  const parser = parserFor(await import(pathToFileURL(bundle)), label);
  const sources = sourcesFor(label, size);
  let sink = 0;
  const run = () => {
    for (const source of sources) {
      const result = parser(source);
      sink += result.children?.length ?? result.length;
    }
  };
  for (let i = 0; i < 5; i++) run();
  let count = 1;
  for (;;) {
    const started = performance.now();
    for (let i = 0; i < count; i++) run();
    if (performance.now() - started >= 15) break;
    count *= 2;
  }
  const samples = [];
  for (let round = -3; round < 13; round++) {
    const started = performance.now();
    for (let i = 0; i < count; i++) run();
    if (round >= 0) samples.push((performance.now() - started) / count);
  }
  process.stdout.write(JSON.stringify({ median: median(samples), samples, count, sink }));
} else {
  const args = process.argv.slice(2);
  const baseIndex = args.indexOf('--baseline');
  const git = (...gitArgs) => execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
  const baseline = git('rev-parse', baseIndex >= 0 ? args[baseIndex + 1] : 'HEAD^');
  const repository = git('rev-parse', '--show-toplevel');
  const packagePath = 'packages/liquid-html-parser';
  const output = resolve('node_modules/.cache/raw-boundaries-benchmark');
  const sourceRoot = join(output, 'before');
  mkdirSync(sourceRoot, { recursive: true });
  const archive = join(output, 'before.tar');
  execFileSync('git', ['archive', '--output', archive, baseline, packagePath], {
    cwd: repository,
  });
  execFileSync('tar', ['-xf', archive, '-C', sourceRoot]);
  const beforePackage = join(sourceRoot, packagePath);
  writeFileSync(
    join(beforePackage, 'tsconfig.json'),
    JSON.stringify({ extends: resolve('packages/liquid-html-parser/tsconfig.json') }),
  );
  // Resolve the baseline's dependencies from the current package.
  if (!existsSync(join(beforePackage, 'node_modules'))) {
    symlinkSync(
      resolve('packages/liquid-html-parser/node_modules'),
      join(beforePackage, 'node_modules'),
    );
  }
  const bundles = {};
  for (const [name, entry] of Object.entries({
    before: join(beforePackage, 'src/index.ts'),
    after: resolve('packages/liquid-html-parser/src/index.ts'),
  })) {
    await build({
      configFile: false,
      logLevel: 'warn',
      // The archived baseline lives under node_modules, where automatic tsconfig
      // discovery differs. Compile both variants with the same field semantics.
      esbuild: { tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } } },
      build: {
        target: 'es2022',
        lib: { entry, formats: ['es'], fileName: () => `${name}.mjs` },
        outDir: output,
        emptyOutDir: false,
        minify: false,
      },
    });
    bundles[name] = join(output, `${name}.mjs`);
  }
  const parsers = {};
  for (const [name, bundle] of Object.entries(bundles)) {
    parsers[name] = await import(pathToFileURL(bundle));
  }
  const plan = [
    ...Object.keys(scenarios),
    'tokenizer/output',
    'tokenizer/quoted',
    'tokenizer/tag',
    'textBeforeHtml',
    'quotedText',
    'quotedOutputs',
  ].flatMap((label) => [1000, 4000].map((size) => ({ label, size })));
  if (args.includes('--themes')) {
    for (const theme of ['dawn', 'horizon']) {
      plan.push({ label: `theme/${theme}`, size: 1 });
    }
  }
  const result = {
    baseline,
    head: git('rev-parse', 'HEAD'),
    node: process.version,
    date: new Date().toISOString(),
    bundleHashes: Object.fromEntries(
      Object.entries(bundles).map(([name, path]) => [
        name,
        createHash('sha256').update(readFileSync(path)).digest('hex'),
      ]),
    ),
    method:
      'Three fresh serial processes per variant/case; 13 batches after warmup; median of process medians.',
    rows: [],
  };
  console.log(`Baseline: ${baseline}`);
  console.log('Case                     Before ms    After ms    After / before');
  for (const { label, size } of plan) {
    const beforeParser = parserFor(parsers.before, label);
    const afterParser = parserFor(parsers.after, label);
    for (const source of sourcesFor(label, size)) {
      if (!isDeepStrictEqual(beforeParser(source), afterParser(source))) {
        throw new Error(`Parsed output differs: ${label} x ${size}`);
      }
    }
    const samples = { before: [], after: [] };
    for (let pass = 0; pass < 3; pass++) {
      for (const name of pass % 2 ? ['after', 'before'] : ['before', 'after']) {
        const measured = JSON.parse(
          execFileSync(
            process.execPath,
            [script, '--worker', JSON.stringify({ bundle: bundles[name], label, size })],
            { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
          ),
        );
        samples[name].push(measured);
      }
    }
    const before = median(samples.before.map((sample) => sample.median));
    const after = median(samples.after.map((sample) => sample.median));
    result.rows.push({ label, size, before, after, samples });
    console.log(
      `${`${label} x ${size}`.padEnd(25)}${before.toFixed(3).padStart(9)}${after.toFixed(3).padStart(12)}${(after / before).toFixed(3).padStart(18)}`,
    );
    writeFileSync(join(output, 'results.json'), JSON.stringify(result, null, 2) + '\n');
  }
  console.log('Parsed output matches for every measured input.');
  console.log('Samples: node_modules/.cache/raw-boundaries-benchmark/results.json');
}
