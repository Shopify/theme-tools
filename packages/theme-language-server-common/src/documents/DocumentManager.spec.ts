import {
  AbstractFileSystem,
  path,
  Section,
  Setting,
  ThemeBlock,
  ThemeSchemaType,
} from '@shopify/theme-check-common';
import { MockFileSystem } from '@shopify/theme-check-common/src/test';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { URI, Utils } from 'vscode-uri';
import { DocumentManager } from './DocumentManager';
import { mockConnection } from '../test/MockConnection';
import { ClientCapabilities } from '../ClientCapabilities';

describe('Module: DocumentManager', () => {
  const mockRoot = 'mock-fs:';
  let documentManager: DocumentManager;
  let connection: ReturnType<typeof mockConnection>;
  let fs: AbstractFileSystem;

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

  describe('when initialized with an abstract file system', () => {
    beforeEach(async () => {
      fs = new MockFileSystem(
        {
          'snippet/foo.liquid': `hello {% render 'bar' %}`,
          'snippet/bar.liquid': `world`,
        },
        'mock-fs:',
      );
      documentManager = new DocumentManager(fs);
      vi.spyOn(fs, 'readFile');
    });

    describe('when the abstract file system is preloaded', () => {
      beforeEach(async () => {
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
      });

      describe('Unit: close(uri)', () => {
        it('sets the source version to undefined (value is on disk)', () => {
          documentManager.open('mock-fs:/snippet/foo.liquid', 'hello {% render "bar" %}', 10);
          documentManager.close('mock-fs:/snippet/foo.liquid');
          const sc = documentManager.get('mock-fs:/snippet/foo.liquid');
          assert(sc);
          expect(sc.source).to.equal('hello {% render "bar" %}');
          expect(sc.version).to.equal(undefined);
        });
      });

      describe('Unit: delete(uri)', () => {
        it('deletes the source code from the document manager', () => {
          // as though the file no longer exists
          documentManager.open('mock-fs:/snippet/foo.liquid', 'hello {% render "bar" %}', 10);
          documentManager.delete('mock-fs:/snippet/foo.liquid');
          const sc = documentManager.get('mock-fs:/snippet/foo.liquid');
          assert(!sc);
        });
      });

      describe('Unit: preload(rootUri)', () => {
        it('should be memoized and only run once', async () => {
          await documentManager.preload('mock-fs:/');
          await documentManager.preload('mock-fs:/');
          await documentManager.preload('mock-fs:/');
          await documentManager.preload('mock-fs:/');
          expect(vi.mocked(fs.readFile)).toHaveBeenCalledTimes(
            documentManager.theme('mock-fs:/', true).length,
          );
        });
      });
    });
  });

  describe('when initialized with a connection & hasProgressSupport', () => {
    beforeEach(() => {
      const capabilities = new ClientCapabilities();
      capabilities.setup({
        window: {
          workDoneProgress: true,
        },
      });
      connection = mockConnection(mockRoot);
      connection.spies.onRequest.mockImplementationOnce(async (method) => {
        switch (method) {
          case 'window/workDoneProgress/create':
            return 'ok';
          default:
            throw new Error(`Unexpected method: ${method}`);
        }
      });

      fs = new MockFileSystem(
        {
          'snippet/1.liquid': `hello {% render 'bar' %}`,
          'snippet/2.liquid': `hello {% render 'bar' %}`,
          'snippet/3.liquid': `hello {% render 'bar' %}`,
          'snippet/4.liquid': `hello {% render 'bar' %}`,
          'snippet/5.liquid': `hello {% render 'bar' %}`,
          'snippet/6.liquid': `hello {% render 'bar' %}`,
          'snippet/7.liquid': `hello {% render 'bar' %}`,
          'snippet/8.liquid': `hello {% render 'bar' %}`,
          'snippet/9.liquid': `hello {% render 'bar' %}`,
          'snippet/10.liquid': `hello {% render 'bar' %}`,
        },
        mockRoot,
      );
      vi.spyOn(fs, 'readFile');

      documentManager = new DocumentManager(fs, connection, capabilities);
    });

    it('should report progress while preloading', async () => {
      await documentManager.preload(mockRoot);
      expect(connection.spies.sendProgress).toHaveBeenCalledTimes(4);
      expect(connection.spies.sendProgress).toHaveBeenCalledWith(
        expect.anything(),
        'preload#mock-fs:',
        {
          kind: 'begin',
          title: 'Initializing Liquid LSP',
        },
      );
      expect(connection.spies.sendProgress).toHaveBeenCalledWith(
        expect.anything(),
        'preload#mock-fs:',
        {
          kind: 'report',
          message: 'Preloading files',
          percentage: 10,
        },
      );
      expect(connection.spies.sendProgress).toHaveBeenCalledWith(
        expect.anything(),
        'preload#mock-fs:',
        {
          kind: 'report',
          message: 'Preloading files [10/10]',
          percentage: 100,
        },
      );
      expect(connection.spies.sendProgress).toHaveBeenCalledWith(
        expect.anything(),
        'preload#mock-fs:',
        {
          kind: 'end',
          message: 'Completed',
        },
      );
    });
  });

  describe('when initialized with a fs, getModeForURI, and isValidSchema', () => {
    const mockFsRoot = path.normalize('mock-fs:/theme');
    const sectionSchema: Section.Schema = {
      name: 'hello',
      settings: [{ type: 'number' as Setting.Type.Number, id: 'my_num' }],
      default: { settings: { my_num: 1 } },
    };
    const blockSchema: ThemeBlock.Schema = {
      name: 'world',
      blocks: [{ type: '@theme' }],
    };

    beforeEach(async () => {
      fs = new MockFileSystem(
        {
          'sections/foo.liquid': `
             {% schema %}
               ${JSON.stringify(sectionSchema, null, 2)}
             {% endschema %}`,
          'blocks/bar.liquid': `
            {% schema %}
              ${JSON.stringify(blockSchema, null, 2)}
            {% endschema %}`,
        },
        mockFsRoot,
      );
      documentManager = new DocumentManager(
        fs,
        undefined,
        undefined,
        async () => 'theme',
        async () => true, // let's assume they are valid for testing purposes...
      );
      await documentManager.preload(mockFsRoot);
    });

    it('should augment section files with a getSchema property that resolves to a type-safe schema', async () => {
      const section = documentManager.get(path.join(mockFsRoot, 'sections/foo.liquid'));
      assert(section);
      assert(section.type === 'LiquidHtml');
      const schema = await section.getSchema();
      assert(schema);
      assert(schema.type === ThemeSchemaType.Section);
      expect(schema.parsed).to.eql(sectionSchema);
      const validSchema = schema.validSchema;
      assert(!(validSchema instanceof Error));

      // Note below that validSchema.name is accessed in a type-safe manner
      expect(validSchema.name).to.equal(sectionSchema.name);
      assert(validSchema.settings);
      for (const setting of validSchema.settings) {
        assert(setting.type);
        assert(setting.id);
      }

      // Default is a section-only property
      assert(validSchema.default);
    });

    it('should augment block files with a getSchema property that resolves to a type-safe schema', async () => {
      const block = documentManager.get(path.join(mockFsRoot, 'blocks/bar.liquid'));
      assert(block);
      assert(block.type === 'LiquidHtml');
      const schema = await block.getSchema();
      assert(schema);
      assert(schema.type === ThemeSchemaType.Block);
      expect(schema.parsed).to.eql(blockSchema);
      const validSchema = schema.validSchema;
      assert(!(validSchema instanceof Error));

      // Note below that validSchema.name is accessed in a type-safe manner
      expect(validSchema.name).to.equal(blockSchema.name);
      assert(validSchema.blocks);
      for (const block of validSchema.blocks) {
        assert(block.type);
      }
    });
  });
});
