import { beforeEach, describe, expect, it } from 'vitest';
import { MockFileSystem } from './MockFileSystem';
import { FileType } from '../AbstractFileSystem';

describe('MockFileSystem', () => {
  let fs: MockFileSystem;

  beforeEach(() => {
    fs = new MockFileSystem({
      'layout/theme.liquid': 'theme.liquid content',
      'layout/password.liquid': 'password.liquid content',
      'snippets/product-card.liquid': 'product-card.liquid content',
      'snippets/product-variant.liquid': 'product-variant.liquid content',
      'sections/section.liquid': 'section.liquid content',
      'assets/js/foo.js': 'foo.js content',
      'assets/js/bar.js': 'bar.js content',
      'assets/theme.js': 'theme.js content',
    });
  });

  describe('readFile', () => {
    it('returns the content of existing files', async () => {
      expect(await fs.readFile('file:/layout/theme.liquid')).toBe('theme.liquid content');
      expect(await fs.readFile('file:/assets/js/foo.js')).toBe('foo.js content');
    });

    it('throws an error for files that do not exist', async () => {
      expect(fs.readFile('does not exist')).rejects.toThrow('File not found');
    });
  });

  describe('readDirectory', () => {
    it('returns the list of files in a leaf', async () => {
      const result = await fs.readDirectory('file:/layout');
      expect(result).to.eql([
        ['file:/layout/theme.liquid', FileType.File],
        ['file:/layout/password.liquid', FileType.File],
      ]);
    });

    it('returns the list of files and directories in a branch', async () => {
      const result = await fs.readDirectory('file:/assets');
      expect(result).to.eql([
        ['file:/assets/js', FileType.Directory],
        ['file:/assets/theme.js', FileType.File],
      ]);
    });

    it('returns the list of files and directories at the root', async () => {
      const result = await fs.readDirectory('file:/');
      expect(result).to.eql([
        ['file:/layout', FileType.Directory],
        ['file:/snippets', FileType.Directory],
        ['file:/sections', FileType.Directory],
        ['file:/assets', FileType.Directory],
      ]);
    });

    it('throws an error for directories that do not exist', async () => {
      expect(fs.readDirectory('file:/does not exist')).rejects.toThrow('Directory not found');
    });
  });

  describe('stat', () => {
    it('returns the size of existing files', async () => {});

    it('throws an error for files that do not exist', async () => {
      expect(fs.stat('file:/does not exist')).rejects.toThrow();
    });
  });
});
