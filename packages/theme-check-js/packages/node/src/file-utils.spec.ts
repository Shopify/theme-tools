import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileSize } from './file-utils';

describe('Module: fileSize', () => {
  it('should exist', () => {
    expect(fileSize).to.exist;
  });

  it('should return file size in bytes', async () => {
    const size = await fileSize(__filename);
    expect(size).to.be.a('number');
  });

  it('should return 0 for non-existing file', async () => {
    const size = await fileSize(path.join(__dirname, 'does-not-exist.txt'));
    expect(size).to.equal(0);
  });
});
