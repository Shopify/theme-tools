import { expect, it, describe, afterEach, afterAll, vi, Mock } from 'vitest';
import fs from 'fs/promises';
import { getPackageJsonRecord } from './getPackageJsonRecord';
// import { promisify } from 'node:util';

vi.mock('fs/promises', async () => ({
  default: { readFile: vi.fn() },
}));

vi.mock('node:util', async () => ({
  promisify: vi.fn((fn) => fn),
}));

vi.stubGlobal('console', {
  error: vi.fn(),
});

describe('getPackageJsonRecord', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('should build a map of package.json data', async () => {
    // @ts-ignore
    (fs.readFile as Mock).mockResolvedValueOnce(
      JSON.stringify({ name: 'package1', version: '1.0.0' }),
    );
    // @ts-ignore
    (fs.readFile as Mock).mockResolvedValueOnce(
      JSON.stringify({ name: 'package2', version: '2.0.0' }),
    );

    const result = await getPackageJsonRecord(['path/to/package1.json', 'path/to/package2.json']);

    expect(result).toEqual({
      package1: { name: 'package1', version: '1.0.0' },
      package2: { name: 'package2', version: '2.0.0' },
    });
  });

  it('should handle errors when reading or parsing package.json files', async () => {
    // @ts-ignore
    (fs.readFile as Mock).mockResolvedValueOnce(
      JSON.stringify({ name: 'package1', version: '1.0.0' }),
    );
    // @ts-ignore
    (fs.readFile as Mock).mockRejectedValueOnce(new Error('test error'));

    const result = await getPackageJsonRecord(['path/to/package1.json', 'path/to/package2.json']);

    expect(result).toEqual({
      package1: { name: 'package1', version: '1.0.0' },
    });
    expect(console.error).toHaveBeenCalledWith(
      'Error reading or parsing package.json file at path/to/package2.json:',
      new Error('test error'),
    );
  });
});
