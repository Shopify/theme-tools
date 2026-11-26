import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  LANGUAGE_SERVER_TIMEOUT_MS,
  captureConsoleErrors,
  hoverText,
  openFixture,
  openThemeFile,
  positionAfter,
  positionIn,
  themeUri,
  waitFor,
  waitForThemeCheckDiagnostics,
  writeFixture,
} from './helpers';
import { LanguageServerWorker, startMonitoredLanguageServer } from './languageServerWorker';

const EDITED_FILES = [
  'snippets/e2e-unknown-filter.liquid',
  'snippets/e2e-on-type.liquid',
  'snippets/e2e-on-type-closed.liquid',
];

suite('Browser language features', function () {
  this.timeout(2 * LANGUAGE_SERVER_TIMEOUT_MS);

  let server: LanguageServerWorker;
  let extensionHost: ReturnType<typeof captureConsoleErrors>;

  suiteSetup(async function () {
    this.timeout(3 * LANGUAGE_SERVER_TIMEOUT_MS);
    extensionHost = captureConsoleErrors();
    // When the server learns that an open file was created, it replaces the
    // document with the file on disk, and that event can arrive after a test's
    // edit. The files that tests edit are created before the server starts.
    await Promise.all(EDITED_FILES.map((file) => writeFixture(file, '')));
    server = await startMonitoredLanguageServer();
  });

  suiteTeardown(() => {
    extensionHost.restore();
  });

  suite('Diagnostics', () => {
    test('reports an unknown filter and clears the offense once it is fixed', async () => {
      const document = await openThemeFile('snippets/e2e-unknown-filter.liquid');
      await replaceText(document, '{{ product.title | e2e_not_a_filter }}\n');

      await waitForThemeCheckDiagnostics(document, (diagnostics) =>
        diagnostics.some(
          (d) =>
            d.code === 'UnknownFilter' &&
            d.severity === vscode.DiagnosticSeverity.Error &&
            d.message === "Unknown filter 'e2e_not_a_filter' used.",
        ),
      );

      await replaceText(document, '{{ product.title | upcase }}\n');

      await waitForThemeCheckDiagnostics(
        document,
        (diagnostics) => !diagnostics.some((d) => d.code === 'UnknownFilter'),
      );
    });

    test('reports a range setting default off the step grid (ValidRangeDefault)', async () => {
      const document = await openFixture(
        'sections/e2e-range-default.liquid',
        [
          '<div></div>',
          '{% schema %}',
          JSON.stringify(
            {
              name: 'E2E range default',
              settings: [
                {
                  type: 'range',
                  id: 'padding',
                  label: 'Padding',
                  min: 0,
                  max: 160,
                  step: 8,
                  unit: 'px',
                  default: 60,
                },
              ],
            },
            null,
            2,
          ),
          '{% endschema %}',
          '',
        ].join('\n'),
      );

      const diagnostics = await waitForThemeCheckDiagnostics(document, (diagnostics) =>
        diagnostics.some((d) => d.code === 'ValidRangeDefault'),
      );

      const [offense, ...others] = diagnostics.filter((d) => d.code === 'ValidRangeDefault');
      assert.deepStrictEqual(others, []);
      assert.strictEqual(offense.text, '60');
      assert.match(offense.message, /^Default value 60 for range setting "padding"/);
    });
  });

  suite('Hover', () => {
    test('documents a filter', async () => {
      const document = await openFixture(
        'snippets/e2e-hover-filter.liquid',
        '{{ product.title | upcase }}\n',
      );

      const text = await waitFor(
        'a hover for the upcase filter',
        () => hover(document, positionIn(document, 'upcase')),
        (text) => text.includes('### upcase'),
      );

      assert.match(text, /uppercase/i);
    });

    test('documents an object', async () => {
      const document = await openFixture(
        'snippets/e2e-hover-object.liquid',
        '{{ product.title }}\n',
      );

      await waitFor(
        'a hover for the product object',
        () => hover(document, positionIn(document, 'product')),
        (text) => text.includes('### product'),
      );
    });
  });

  suite('Document links', () => {
    test('links a rendered snippet to its file', async () => {
      await writeFixture('snippets/e2e-linked-snippet.liquid', 'Linked');
      const document = await openFixture(
        'snippets/e2e-render-link.liquid',
        "{% render 'e2e-linked-snippet' %}\n",
      );

      const targets = await waitFor(
        'a document link to the rendered snippet',
        () => linkTargets(document),
        (targets) => targets.length > 0,
      );

      assert.deepStrictEqual(targets, [themeUri('snippets/e2e-linked-snippet.liquid').toString()]);
    });

    test('links an asset_url to the Liquid file that generates the asset', async () => {
      await writeFixture('assets/e2e-generated.css.liquid', 'body { color: red; }');
      const document = await openFixture(
        'snippets/e2e-asset-link.liquid',
        "{{ 'e2e-generated.css' | asset_url | stylesheet_tag }}\n",
      );

      const targets = await waitFor(
        'a document link to the asset',
        () => linkTargets(document),
        (targets) => targets.length > 0,
      );

      assert.deepStrictEqual(targets, [themeUri('assets/e2e-generated.css.liquid').toString()]);
    });
  });

  suite('On-type formatting', () => {
    test('typing ">" in the editor closes the element', async () => {
      const document = await openThemeFile('snippets/e2e-on-type.liquid');
      await replaceText(document, '<div>\n');
      const inside = positionAfter(document, '<div>');

      // Typing has no retry, so first wait for the server to have the document.
      await waitFor(
        'the server to close an open <div>',
        () => onTypeEdits(document, inside),
        (edits) => edits.some((edit) => edit.newText === '</div>'),
      );

      await replaceText(document, '<div\n');
      const editor = await vscode.window.showTextDocument(document);
      const cursor = positionAfter(document, '<div');
      editor.selection = new vscode.Selection(cursor, cursor);
      await vscode.commands.executeCommand('type', { text: '>' });

      // The server also moves the cursor back between the tags, 10ms after it
      // answers. That races with VS Code applying the edit, so it isn't checked.
      await waitFor(
        'the closing tag',
        () => document.getText(),
        (text) => text === '<div></div>\n',
        5_000,
      );
    });

    test('typing ">" leaves a closed element alone when later syntax does not parse', async () => {
      const document = await openThemeFile('snippets/e2e-on-type-closed.liquid');
      await replaceText(document, '<div><p>');
      const afterP = positionAfter(document, '<div><p>');

      // Control: the server closes the <p> while it is open.
      await waitFor(
        'the server to close an open <p>',
        () => onTypeEdits(document, afterP),
        (edits) => edits.some((edit) => edit.newText === '</p>'),
      );

      await replaceText(document, '<div><p></p>{{ unfinished');

      assert.deepStrictEqual(await onTypeEdits(document, afterP), []);
    });
  });

  suite('Rename', () => {
    test('renames a variable where it is assigned and where it is used', async () => {
      const document = await openFixture(
        'snippets/e2e-rename.liquid',
        '{% assign e2e_title = product.title %}\n<h2>{{ e2e_title }}</h2>\n',
      );

      const edit = await waitFor(
        'rename edits for the variable',
        () =>
          vscode.commands.executeCommand<vscode.WorkspaceEdit | undefined>(
            'vscode.executeDocumentRenameProvider',
            document.uri,
            positionIn(document, 'e2e_title }}'),
            'e2e_heading',
          ),
        (edit) => edit !== undefined && edit.size > 0,
      );

      assert.ok(await vscode.workspace.applyEdit(edit!));
      assert.strictEqual(
        document.getText(),
        '{% assign e2e_heading = product.title %}\n<h2>{{ e2e_heading }}</h2>\n',
      );
    });
  });

  suite('Document formatting', () => {
    test('formats a Liquid document, and formatting it again changes nothing', async () => {
      const document = await openFixture(
        'snippets/e2e-format.liquid',
        '{% if product %}<div class="card"><h2>{{product.title|upcase}}</h2>' +
          '{% render "price",product:product %}</div>{% endif %}\n',
      );

      const edits = await formatEdits(document);
      assert.notDeepStrictEqual(edits, [], 'Expected the formatter to return edits');
      await applyEdits(document, edits);

      assert.strictEqual(
        document.getText(),
        [
          '{% if product %}',
          '  <div class="card">',
          '    <h2>{{ product.title | upcase }}</h2>',
          "    {% render 'price', product: product %}",
          '  </div>',
          '{% endif %}',
          '',
        ].join('\n'),
      );
      assert.deepStrictEqual(
        (await formatEdits(document)).filter(
          (edit) => document.getText(edit.range) !== edit.newText,
        ),
        [],
      );
    });
  });

  suite('Errors while serving the requests above', () => {
    test('the language server worker reports none', () => {
      assert.deepStrictEqual(server.errors, []);
    });

    test('the extension host logs none', () => {
      assert.deepStrictEqual(extensionHost.errors, []);
    });
  });
});

async function replaceText(document: vscode.TextDocument, text: string) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange(document), text);
  assert.ok(await vscode.workspace.applyEdit(edit), 'Expected the edit to apply');
}

async function applyEdits(document: vscode.TextDocument, edits: vscode.TextEdit[]) {
  const edit = new vscode.WorkspaceEdit();
  edit.set(document.uri, edits);
  assert.ok(await vscode.workspace.applyEdit(edit), 'Expected the edits to apply');
}

function fullRange(document: vscode.TextDocument) {
  return new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
}

async function hover(document: vscode.TextDocument, position: vscode.Position) {
  const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
    'vscode.executeHoverProvider',
    document.uri,
    position,
  );
  return hoverText(hovers);
}

async function linkTargets(document: vscode.TextDocument) {
  const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
    'vscode.executeLinkProvider',
    document.uri,
  );
  return (links ?? []).map((link) => link.target?.toString());
}

async function onTypeEdits(document: vscode.TextDocument, position: vscode.Position) {
  const edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
    'vscode.executeFormatOnTypeProvider',
    document.uri,
    position,
    '>',
    { tabSize: 2, insertSpaces: true },
  );
  return (edits ?? []).map((edit) => ({ newText: edit.newText }));
}

async function formatEdits(document: vscode.TextDocument) {
  const edits = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
    'vscode.executeFormatDocumentProvider',
    document.uri,
    { tabSize: 2, insertSpaces: true },
  );
  return edits ?? [];
}
