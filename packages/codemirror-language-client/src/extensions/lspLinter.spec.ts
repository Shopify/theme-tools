// @vitest-environment jsdom
import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { EditorState, Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { Diagnostic as CodeMirrorDiagnostic } from '@codemirror/lint';
import { diagnosticsFacet, lspLinter } from './lspLinter';
import { clientFacet, fileUriFacet } from './client';
import { MockClient } from '../test/MockClient';
import { DiagnosticSeverity, PublishDiagnosticsNotification } from 'vscode-languageserver-protocol';

describe('Module: lspLinter', () => {
  const fileUri = 'browser://input.liquid';
  let client: MockClient;
  let extensions: Extension;
  let view: EditorView;

  beforeEach(() => {
    client = new MockClient();
    extensions = [clientFacet.of(client), fileUriFacet.of(fileUri), lspLinter];
    view = new EditorView({
      state: EditorState.create({
        doc: 'hello world',
        extensions,
      }),
    });
  });

  afterEach(() => {
    view.destroy();
  });

  describe('When it receives up to date diagnostics from the server', () => {
    beforeEach(async () => {
      client.triggerNotification(PublishDiagnosticsNotification.type, {
        uri: fileUri,
        version: 0,
        diagnostics: [
          {
            message: 'hello not accepted',
            severity: DiagnosticSeverity.Error,
            range: {
              start: {
                line: 0,
                character: 0,
              },
              end: {
                line: 0,
                character: 'hello'.length,
              },
            },
          },
        ],
      });
    });

    it('should make them available in the diagnosticState', () => {
      const codeMirrorDiagnostics = view.state.facet(diagnosticsFacet.reader);
      expect(codeMirrorDiagnostics).to.have.lengthOf(1);
      const expectedDiagnostic: CodeMirrorDiagnostic = {
        from: 0,
        to: 'hello'.length,
        message: 'hello not accepted',
        severity: 'error',
      };
      expect(codeMirrorDiagnostics[0]).to.eql(expectedDiagnostic);
    });
  });

  describe('When it receives out of date diagnostics from the server', () => {
    beforeEach(async () => {
      // Here we dispatch a doc change, this internally increments the
      // version value of the textDocument by 1.
      view.dispatch(
        view.state.update({
          changes: {
            from: 0,
            to: 'hello world'.indexOf(' '),
            insert: 'hi',
          },
        }),
      );

      // Here we dispatch a set of diagnostics for the old state
      client.triggerNotification(PublishDiagnosticsNotification.type, {
        uri: fileUri,
        version: 0, // Note: since the file was modified, those diagnostics are out of date
        diagnostics: [
          {
            message: 'hello not accepted',
            severity: DiagnosticSeverity.Error,
            range: {
              start: {
                line: 0,
                character: 0,
              },
              end: {
                line: 0,
                character: 'hello'.length,
              },
            },
          },
        ],
      });
    });

    it('should discard the stale diagnostics', () => {
      const codeMirrorDiagnostics = view.state.facet(diagnosticsFacet.reader);
      expect(codeMirrorDiagnostics).to.have.lengthOf(0);
    });
  });

  describe('When it changes the document and the diagnostics are suddenly stale', () => {
    beforeEach(async () => {
      // Here we dispatch a set of diagnostics for the state, they are up to date
      client.triggerNotification(PublishDiagnosticsNotification.type, {
        uri: fileUri,
        version: 0,
        diagnostics: [
          {
            message: 'hello not accepted',
            severity: DiagnosticSeverity.Error,
            range: {
              start: {
                line: 0,
                character: 0,
              },
              end: {
                line: 0,
                character: 'hello'.length,
              },
            },
          },
        ],
      });

      // Here we dispatch a doc change. This internally increments the
      // version value of the textDocument by 1. The diagnostics are now
      // stale.
      view.dispatch(
        view.state.update({
          changes: {
            from: 0,
            to: 'hello world'.indexOf(' '),
            insert: 'hi',
          },
        }),
      );
    });

    it('should discard the stale diagnostics', () => {
      const codeMirrorDiagnostics = view.state.facet(diagnosticsFacet.reader);
      expect(codeMirrorDiagnostics).to.have.lengthOf(0);
    });
  });
});
