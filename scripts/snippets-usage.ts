#!/usr/bin/env ts-node
import { LiquidTag, NodeTypes } from '@shopify/liquid-html-parser';
import { getThemeAndConfig, path, SourceCode, SourceCodeType } from '@shopify/theme-check-node';
import { visit } from '@shopify/theme-language-server-common';
import { URI } from 'vscode-uri';

type UsedBy = Record<string, number>;
type Stats = Record<string, UsedBy>;

async function main() {
  const args = process.argv.slice(2);
  const themePath = args[0];
  if (!args[0]) {
    console.error('Usage: scripts/snippets-usage <theme-root-path>');
    console.error();
    console.error('This script will output a list of snippets and the files that use them.');
    process.exit(0);
  }

  const { theme } = await getThemeAndConfig(themePath);
  const stats: Stats = {};
  const root = URI.file(themePath).toString();
  const liquidFiles = theme.filter(
    (f): f is SourceCode<SourceCodeType.LiquidHtml> => f.type === SourceCodeType.LiquidHtml,
  );
  for (const file of liquidFiles) {
    if (file.ast instanceof Error) continue;

    const relative = path.relative(file.uri, root);

    visit(file.ast, {
      LiquidTag(node: LiquidTag) {
        if (node.name !== 'include' && node.name !== 'render') return;
        if (typeof node.markup === 'string') return;
        const snippet = node.markup.snippet;
        if (snippet.type !== NodeTypes.String) return;
        const snippetPath = `snippets/${snippet.value}.liquid`;
        stats[snippetPath] ??= {};
        stats[snippetPath][relative] ??= 0;
        stats[snippetPath][relative]++;
      },
    });
  }

  for (const [snippet, usedBy] of Object.entries(stats)) {
    console.log(snippet);
    for (const [file, count] of Object.entries(usedBy)) {
      console.log(`  ${count.toString().padEnd(2)} ${file}`);
    }
  }
}

main();
