import { exec } from './utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExtensionContext } from 'vscode';
import { fetchProfileContents, LiquidProfiler } from './LiquidProfiler';

// Mock the vscode namespace
vi.mock('vscode', () => ({
  window: {
    createTextEditorDecorationType: vi.fn(),
    visibleTextEditors: [],
    onDidChangeActiveTextEditor: vi.fn(),
  },
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
  },
  Uri: {
    file: vi.fn((path) => ({ fsPath: path })),
  },
}));

// Mock child_process
vi.mock('./utils', () => ({
  exec: vi.fn(),
}));

describe('LiquidProfiler', () => {
  let profiler: LiquidProfiler;

  beforeEach(() => {
    const mockContext = {
      subscriptions: [],
      asAbsolutePath: (path: string) => path,
    } as unknown as ExtensionContext;

    profiler = new LiquidProfiler(mockContext);
  });

  describe('fetchProfileContents', () => {
    it('successfully retrieves profile content', async () => {
      const mockJson = '{"profiles":[{"events":[]}]}';
      vi.mocked(exec).mockReturnValue(Promise.resolve({ stdout: mockJson, stderr: '' }));

      const result = await fetchProfileContents('http://example.com');
      expect(result).toBe(mockJson);
    });

    it('handles CLI errors gracefully', async () => {
      const mockError = new Error('CLI Error');
      (mockError as any).stderr = 'Command failed';
      vi.mocked(exec).mockReturnValue(Promise.reject(mockError));

      const result = await fetchProfileContents('http://example.com');
      expect(result).toContain('Error loading preview');
      expect(result).toContain('Command failed');
    });
  });

  describe('processAndShowDecorations', () => {
    it('correctly processes profile data', async () => {
      const mockProfileData = `
      { "$schema": "https://www.speedscope.app/file-format-schema.json",
        "profiles": [
          {
            "endValue": 41909555,
            "events": [
              {
                "at": 37784852,
                "frame": 0,
                "type": "O"
              },
              {
                "at": 37789358,
                "frame": 1,
                "type": "O"
              },
              {
                "at": 38024944,
                "frame": 1,
                "type": "C"
              },
              {
                "at": 38034236,
                "frame": 0,
                "type": "C"
              },
              {
                "at": 41016946,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41460602,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41463080,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41484386,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41488234,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41526318,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41527218,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41534543,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41536993,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41572058,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41573813,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41584064,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41586432,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41616048,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41616801,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41622816,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41624627,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41646737,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41647420,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41653219,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41654628,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41672842,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41673530,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41678977,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41680459,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41698643,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41699289,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41705042,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41706325,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41729032,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41729774,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41735999,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41737351,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41754883,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41755531,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41761222,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41762813,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41780166,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41780797,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41786290,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41787733,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41806590,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41807720,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41813397,
                "frame": 3,
                "type": "C"
              },
              {
                "at": 41814981,
                "frame": 2,
                "type": "O"
              },
              {
                "at": 41833653,
                "frame": 2,
                "type": "C"
              },
              {
                "at": 41840919,
                "frame": 3,
                "type": "O"
              },
              {
                "at": 41846881,
                "frame": 3,
                "type": "C"
              }
            ],
            "name": "liquid_vm-cpu-37784852",
            "startValue": 37784852,
            "type": "evented",
            "unit": "nanoseconds"
          }
        ],
        "shared": {
          "frames": [
            {
              "file": "sections/single-collection",
              "line": 7,
              "name": "variable:'favicon.png' | asset_url"
            },
            {
              "name": "filter:asset_url"
            },
            {
              "file": "sections/single-collection",
              "line": 13,
              "name": "variable:child.system.url"
            },
            {
              "file": "snippets/collection-item",
              "line": 15,
              "name": "variable:child.name"
            }
          ]
        }
      }`;

      const profile = JSON.parse(mockProfileData);
      const executionTimes = profiler['calculateExecutionTimes'](profile);

      expect(executionTimes).toEqual({
        fileExecutionTimes: new Map([
          ['sections/single-collection.liquid', 949434],
          ['snippets/collection-item.liquid', 90944],
        ]),
        lineExecutionTimes: new Map([
          [
            {
              file: 'sections/single-collection',
              line: 7,
              name: "variable:'favicon.png' | asset_url",
            },
            249384,
          ],
          [
            {
              file: 'sections/single-collection',
              line: 13,
              name: 'variable:child.system.url',
            },
            700050,
          ],
          [
            {
              file: 'snippets/collection-item',
              line: 15,
              name: 'variable:child.name',
            },
            90944,
          ],
        ]),
      });
    });

    it('handles invalid profile data gracefully', async () => {
      const invalidProfileData = 'invalid json';

      await expect(profiler['processAndShowDecorations'](invalidProfileData)).rejects.toThrow();
    });
  });
});
