import { expect, describe, it } from 'vitest';
import { assertFileExists, assertFileSize } from './file-utils';

describe('file-utils', () => {
  describe('assertFileExists', () => {
    it('returns true if file exists', async () => {
      const context = {
        absolutePath: (filePath: string) => `absolute/${filePath}`,
        fileExists: async (filePath: string) => filePath === 'absolute/test-file',
      };

      const exists = await assertFileExists(context as any, 'test-file');

      expect(exists).toBe(true);
    });

    it('returns false if file does not exist', async () => {
      const context = {
        absolutePath: (filePath: string) => `absolute/${filePath}`,
        fileExists: async (filePath: string) => filePath === 'absolute/test-file',
      };

      const exists = await assertFileExists(context as any, 'non-existent-file');

      expect(exists).toBe(false);
    });
  });

  describe('assertFileSize', () => {
    it('returns false if file size is less than or equal to threshold', async () => {
      const isOverThreshold = await assertFileSize(100, 50);

      expect(isOverThreshold).toBe(false);
    });

    it('returns true if file size is greater than threshold', async () => {
      const isOverThreshold = await assertFileSize(100, 200);

      expect(isOverThreshold).toBe(true);
    });
  });
});
