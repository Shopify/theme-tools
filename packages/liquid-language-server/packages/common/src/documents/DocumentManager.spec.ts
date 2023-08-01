import { expect, describe, it, beforeEach } from 'vitest';
import { DocumentManager } from './DocumentManager';
import { URI, Utils } from 'vscode-uri';

describe('Module: DocumentManager', () => {
  let documentManager: DocumentManager;

  beforeEach(() => {
    documentManager = new DocumentManager();
  });

  it('should return a theme for a root', () => {
    // these will be different in windows vs unix
    const rootUri = URI.file(__dirname);
    const fileUri = Utils.joinPath(rootUri, 'test.liquid');

    // We expect forward slash paths (windows path get normalized)
    expect(fileUri.path).not.to.include('\\');
    documentManager.open(fileUri.toString(), '{{ "hi" }}', 0);
    const theme = documentManager.theme(rootUri.toString());
    expect(theme).to.have.lengthOf(1);
    expect(theme[0].absolutePath).not.to.include('\\');
    // `fileURI.toString()` lowercases c: in 'C:\dir\path'
    // Without the URI.parse().path, this test was failing for a dumb reason
    expect(theme[0].absolutePath).to.equal(URI.parse(fileUri.toString()).path);
  });
});
