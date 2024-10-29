import { path } from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { assert, beforeEach, describe, expect, it } from 'vitest';
import { URI, Utils } from 'vscode-uri';
import { DocumentManager } from './DocumentManager';

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
    const theme = documentManager.theme(path.normalize(rootUri));
    expect(theme).to.have.lengthOf(1);
    expect(theme[0].uri).not.to.include('\\');
    // `fileURI.toString()` lowercases c: in 'C:\dir\path'
    // Without the URI.parse().path, this test was failing for a dumb reason
    expect(theme[0].uri).to.equal(path.normalize(fileUri));
  });

  describe('when initialized and preloaded with an abstract file system', () => {
    let fs: MockFileSystem;
    beforeEach(async () => {
      fs = new MockFileSystem(
        {
          'snippet/foo.liquid': `hello {% render 'bar' %}`,
          'snippet/bar.liquid': `world`,
        },
        'mock-fs:',
      );
      documentManager = new DocumentManager(fs);
      await documentManager.preload('mock-fs:/');
    });

    it('preloads source codes with a version of undefined', async () => {
      const sc = documentManager.get('mock-fs:/snippet/foo.liquid');
      assert(sc);
      expect(sc.version).to.equal(undefined);
    });

    it('returns defined versions of opened files', () => {
      documentManager.open('mock-fs:/snippet/foo.liquid', 'hello {% render "bar" %}', 0);
      const sc = documentManager.get('mock-fs:/snippet/foo.liquid');
      assert(sc);
      expect(sc.version).to.equal(0);
    });

    describe('Unit: theme(rootUri, includeFilesFromDisk)', () => {
      it('only returns the source codes of the opened files by default', () => {
        const theme = documentManager.theme('mock-fs:/');
        expect(theme).to.have.lengthOf(0);
      });

      it('returns all the files when called with includeFilesFromDisk', async () => {
        const theme = documentManager.theme('mock-fs:/', true);
        expect(theme).to.have.lengthOf(2);
      });

      it('is possible to remove files from the cache after preload', async () => {
        documentManager.close('mock-fs:/snippet/foo.liquid');
        const theme = documentManager.theme('mock-fs:/', true);
        expect(theme).to.have.lengthOf(1);
      });

      it('is possible to remove files from the cache after preload', async () => {
        documentManager.delete('mock-fs:/snippet/foo.liquid');
        const theme = documentManager.theme('mock-fs:/', true);
        expect(theme).to.have.lengthOf(1);
      });
    });
  });
});
