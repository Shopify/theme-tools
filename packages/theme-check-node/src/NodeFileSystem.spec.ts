import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import { NodeFileSystem } from './NodeFileSystem';
import { URI } from 'vscode-uri';
import path from 'node:path';
import os from 'node:os';

describe('NodeFileSystem', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodefilesystem-test-'));
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('readFiles', () => {
    it('should read multiple files in batch', async () => {
      // Create test files
      const file1Path = path.join(tempDir, 'file1.liquid');
      const file2Path = path.join(tempDir, 'file2.json');
      const file3Path = path.join(tempDir, 'file3.liquid');

      await fs.writeFile(file1Path, 'content1');
      await fs.writeFile(file2Path, '{"key": "value"}');
      await fs.writeFile(file3Path, 'content3');

      const uris = [
        URI.file(file1Path).toString(),
        URI.file(file2Path).toString(),
        URI.file(file3Path).toString(),
      ];

      const result = await NodeFileSystem.readFiles!(uris);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(3);
      expect(result.get(URI.file(file1Path).toString())).toBe('content1');
      expect(result.get(URI.file(file2Path).toString())).toBe('{"key": "value"}');
      expect(result.get(URI.file(file3Path).toString())).toBe('content3');
    });

    it('should handle non-existent files gracefully', async () => {
      const existingFile = path.join(tempDir, 'exists.liquid');
      await fs.writeFile(existingFile, 'exists');

      const uris = [
        URI.file(existingFile).toString(),
        URI.file(path.join(tempDir, 'nonexistent.liquid')).toString(),
      ];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await NodeFileSystem.readFiles!(uris);

      expect(result.size).toBe(2);
      expect(result.get(URI.file(existingFile).toString())).toBe('exists');
      expect(result.get(URI.file(path.join(tempDir, 'nonexistent.liquid')).toString())).toBe('');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should process files in chunks', async () => {
      // Create many test files
      const fileCount = 50;
      const files = [];
      const uris = [];

      for (let i = 0; i < fileCount; i++) {
        const filePath = path.join(tempDir, `file${i}.liquid`);
        const content = `content${i}`;
        await fs.writeFile(filePath, content);
        files.push({ path: filePath, content });
        uris.push(URI.file(filePath).toString());
      }

      const result = await NodeFileSystem.readFiles!(uris);

      expect(result.size).toBe(fileCount);
      for (const { path: filePath, content } of files) {
        expect(result.get(URI.file(filePath).toString())).toBe(content);
      }
    });
  });

  describe('readDirectories', () => {
    it('should read multiple directories in batch', async () => {
      // Create test directory structure
      const dir1 = path.join(tempDir, 'dir1');
      const dir2 = path.join(tempDir, 'dir2');

      await fs.mkdir(dir1);
      await fs.mkdir(dir2);

      await fs.writeFile(path.join(dir1, 'file1.liquid'), 'content');
      await fs.writeFile(path.join(dir1, 'file2.json'), '{}');
      await fs.mkdir(path.join(dir1, 'subdir'));

      await fs.writeFile(path.join(dir2, 'file3.liquid'), 'content');

      const uris = [URI.file(dir1).toString(), URI.file(dir2).toString()];

      const result = await NodeFileSystem.readDirectories!(uris);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);

      const dir1Contents = result.get(URI.file(dir1).toString());
      expect(dir1Contents).toBeDefined();
      expect(dir1Contents!.length).toBe(3);

      const dir2Contents = result.get(URI.file(dir2).toString());
      expect(dir2Contents).toBeDefined();
      expect(dir2Contents!.length).toBe(1);
    });

    it('should handle non-existent directories gracefully', async () => {
      const existingDir = path.join(tempDir, 'exists');
      await fs.mkdir(existingDir);
      await fs.writeFile(path.join(existingDir, 'file.liquid'), 'content');

      const uris = [
        URI.file(existingDir).toString(),
        URI.file(path.join(tempDir, 'nonexistent')).toString(),
      ];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await NodeFileSystem.readDirectories!(uris);

      expect(result.size).toBe(2);
      expect(result.get(URI.file(existingDir).toString())!.length).toBe(1);
      expect(result.get(URI.file(path.join(tempDir, 'nonexistent')).toString())).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('backward compatibility', () => {
    it('should still support individual readFile calls', async () => {
      const filePath = path.join(tempDir, 'single.liquid');
      await fs.writeFile(filePath, 'single file content');

      const content = await NodeFileSystem.readFile(URI.file(filePath).toString());

      expect(content).toBe('single file content');
    });

    it('should still support individual readDirectory calls', async () => {
      const dirPath = path.join(tempDir, 'single-dir');
      await fs.mkdir(dirPath);
      await fs.writeFile(path.join(dirPath, 'file.liquid'), 'content');

      const contents = await NodeFileSystem.readDirectory(URI.file(dirPath).toString());

      expect(contents.length).toBe(1);
      expect(contents[0][0]).toContain('file.liquid');
    });
  });
});
