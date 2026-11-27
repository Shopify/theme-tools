import {
  LiquidCheckDefinition,
  Offense,
  Severity,
  SourceCodeType,
  path,
} from '@shopify/theme-check-common';
import { check } from '@shopify/theme-check-common/src/test';
import { describe, expect, it, vi } from 'vitest';
import { CodeAction, TextDocumentEdit } from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DiagnosticsManager } from '../../diagnostics';
import { DocumentManager } from '../../documents';
import { DisableCheckProvider } from './DisableCheckProvider';

/** Reports every `bad` variable lookup. */
const NoBad: LiquidCheckDefinition = {
  meta: {
    code: 'NoBad',
    name: 'No bad',
    docs: { description: 'Reports `bad`', recommended: true },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },
  create(context) {
    return {
      async VariableLookup(node) {
        if (node.name !== 'bad') return;
        context.report({
          message: 'bad',
          startIndex: node.position.start,
          endIndex: node.position.end,
        });
      },
    };
  },
};

const fileName = 'snippets/file.liquid';
const uri = path.join(path.normalize('file:/'), fileName);

async function runNoBad(source: string): Promise<Offense[]> {
  const offenses = await check({ [fileName]: source }, [NoBad]);
  return offenses.filter((offense) => offense.uri === uri);
}

async function codeActionsAt(source: string, needle: string): Promise<CodeAction[]> {
  const version = 1;
  const documentManager = new DocumentManager();
  const diagnosticsManager = new DiagnosticsManager({ sendDiagnostics: vi.fn() } as any);
  documentManager.open(uri, source, version);
  diagnosticsManager.set(uri, version, await runNoBad(source));

  const textDocument = TextDocument.create(uri, 'liquid', version, source);
  const cursor = textDocument.positionAt(source.indexOf(needle) + 1);
  const provider = new DisableCheckProvider(documentManager, diagnosticsManager);
  return provider.codeActions({
    textDocument: { uri },
    range: { start: cursor, end: cursor },
    context: { diagnostics: [] },
  }) as CodeAction[];
}

function applyAction(source: string, action: CodeAction): string {
  const [change] = action.edit!.documentChanges! as TextDocumentEdit[];
  return TextDocument.applyEdits(TextDocument.create(uri, 'liquid', 1, source), change.edits);
}

/**
 * Applies "Disable NoBad for this line" on the `bad` that follows `marker`
 * and checks that only that offense goes away.
 */
async function disableLine(source: string, marker: string) {
  const needle = source.slice(source.indexOf(marker)).match(/bad/)!.index! + source.indexOf(marker);
  const before = await runNoBad(source);
  const [lineAction] = (await codeActionsAt(source, source.slice(needle))).filter((action) =>
    action.title.endsWith('for this line'),
  );
  expect(lineAction?.title).toBe('Disable NoBad for this line');

  const result = applyAction(source, lineAction);
  const after = await runNoBad(result);
  expect(after).toHaveLength(before.length - 1);
  return result;
}

describe('Unit: DisableCheckProvider', () => {
  it('offers to disable the check for the line and for the file', async () => {
    const source = '{{ bad }}\n';
    const actions = await codeActionsAt(source, 'bad');

    expect(actions.map((action) => action.title)).toEqual([
      'Disable NoBad for this line',
      'Disable NoBad for this file',
    ]);
    expect(actions.every((action) => action.kind === 'quickfix')).toBe(true);
    expect(actions[0].diagnostics).toHaveLength(1);
  });

  it('offers nothing when there is no offense under the cursor', async () => {
    const source = '{{ good }}\n{{ bad }}\n';
    expect(await codeActionsAt(source, 'good')).toEqual([]);
  });

  it('disables the whole file with a theme-check-disable comment', async () => {
    const source = '<p>{{ bad }}</p>\n{{ bad }}\n';
    const fileAction = (await codeActionsAt(source, 'bad')).find((action) =>
      action.title.endsWith('for this file'),
    )!;

    const result = applyAction(source, fileAction);
    expect(result).toBe('{% # theme-check-disable NoBad %}\n<p>{{ bad }}</p>\n{{ bad }}\n');
    expect(await runNoBad(result)).toHaveLength(0);
  });

  describe('for this line', () => {
    it('inserts the comment on its own line, keeping the indentation', async () => {
      const source = ['<div>', '  {{ bad }}', '  {{ bad }}', '</div>', ''].join('\n');
      const result = await disableLine(source, '{{ bad }}\n  {{');
      expect(result).toBe(
        [
          '<div>',
          '  {% # theme-check-disable-next-line NoBad %}',
          '  {{ bad }}',
          '  {{ bad }}',
          '</div>',
          '',
        ].join('\n'),
      );
    });

    it('disables an offense in the opening tag of an element', async () => {
      const source = ['<div class="{{ bad }}">', '  {{ bad }}', '</div>', ''].join('\n');
      const result = await disableLine(source, 'class');
      expect(result).toBe(
        [
          '{% # theme-check-disable-next-line NoBad %}',
          '<div class="{{ bad }}">',
          '  {{ bad }}',
          '</div>',
          '',
        ].join('\n'),
      );
    });

    it('inserts the comment inline when the node does not start its line', async () => {
      const source = '<p>{{ bad }}</p>\n{{ bad }}\n';
      const result = await disableLine(source, '<p>');
      expect(result).toBe(
        '<p>{% # theme-check-disable-next-line NoBad %}{{ bad }}</p>\n{{ bad }}\n',
      );
    });

    it('disables an offense in an if condition', async () => {
      const source = ['{% if bad %}', '  {{ bad }}', '{% endif %}', ''].join('\n');
      await disableLine(source, '{% if');
    });

    it('disables an offense in the body of an if', async () => {
      const source = ['{% if bad %}', '  {{ bad }}', '{% endif %}', ''].join('\n');
      await disableLine(source, '  {{');
    });

    it('disables an offense in an elsif condition', async () => {
      const source = [
        '{% if a %}',
        '  {{ a }}',
        '{% elsif bad %}',
        '  {{ bad }}',
        '{% endif %}',
        '',
      ].join('\n');
      await disableLine(source, '{% elsif');
    });

    it('disables an offense in a for loop', async () => {
      const source = ['{% for item in bad %}', '  {{ bad }}', '{% endfor %}', ''].join('\n');
      await disableLine(source, '{% for');
      await disableLine(source, '  {{');
    });

    it('disables an offense in a when condition', async () => {
      const source = [
        '{% case a %}',
        '  {% when 1 %}',
        '    {{ a }}',
        '  {% when bad %}',
        '    {{ bad }}',
        '{% endcase %}',
        '',
      ].join('\n');
      await disableLine(source, '{% when bad');
    });

    it('disables an offense in a capture and in a script', async () => {
      const source = [
        '{% capture x %}',
        '  {{ bad }}',
        '{% endcapture %}',
        '<script>',
        '  var a = {{ bad | json }};',
        '</script>',
        '',
      ].join('\n');
      await disableLine(source, '  {{ bad }}');
      await disableLine(source, 'var a');
    });

    it('uses # comments inside a liquid tag', async () => {
      const source = ['{% liquid', '  echo bad', '  echo bad', '%}', ''].join('\n');
      const result = await disableLine(source, 'echo bad\n  echo');
      expect(result).toBe(
        [
          '{% liquid',
          '  # theme-check-disable-next-line NoBad',
          '  echo bad',
          '  echo bad',
          '%}',
          '',
        ].join('\n'),
      );
    });

    it('disables an offense nested in a liquid tag', async () => {
      const source = [
        '{% liquid',
        '  if a',
        '    echo bad',
        '  endif',
        '  echo bad',
        '%}',
        '',
      ].join('\n');
      await disableLine(source, '    echo');
    });

    it('disables an offense on the first line of a liquid tag', async () => {
      const source = '{% liquid echo bad\n  echo bad\n%}\n';
      await disableLine(source, 'liquid echo');
    });
  });

  it('does not offer a line action for JSON files', async () => {
    const documentManager = new DocumentManager();
    const diagnosticsManager = new DiagnosticsManager({ sendDiagnostics: vi.fn() } as any);
    const jsonUri = path.join(path.normalize('file:/'), 'templates/index.json');
    documentManager.open(jsonUri, '{}', 1);
    diagnosticsManager.set(jsonUri, 1, [
      {
        type: SourceCodeType.JSON,
        check: 'ValidJSON',
        message: 'bad',
        uri: jsonUri,
        severity: Severity.ERROR,
        start: { line: 0, character: 0, index: 0 },
        end: { line: 0, character: 2, index: 2 },
      },
    ]);
    const provider = new DisableCheckProvider(documentManager, diagnosticsManager);
    const cursor = { line: 0, character: 1 };
    expect(
      provider.codeActions({
        textDocument: { uri: jsonUri },
        range: { start: cursor, end: cursor },
        context: { diagnostics: [] },
      }),
    ).toEqual([]);
  });
});
