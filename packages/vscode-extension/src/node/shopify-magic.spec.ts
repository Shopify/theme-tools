/* eslint-disable @typescript-eslint/naming-convention */

import { it, expect, describe, vi, afterEach, afterAll } from 'vitest';
import { window, TextEditor, lm } from 'vscode';
import { getShopifyMagicAnalysis } from './shopify-magic';

vi.mock('vscode', async () => ({
  window: {
    createTextEditorDecorationType: vi.fn().mockReturnValue({ key: 'mock-key' }),
  },
  LanguageModelChatMessage: {
    User: vi.fn((msg) => ({ content: msg })),
  },
  lm: {
    selectChatModels: vi.fn(),
  },
  CancellationTokenSource: vi.fn(() => ({ token: 'mock-token' })),
  Range: vi.fn((startLine, startChar, endLine, endChar) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  })),
  Position: vi.fn((line, character) => ({ line, character })),
  MarkdownString: vi.fn((text) => ({
    value: text,
    isTrusted: true,
    supportThemeIcons: true,
  })),
}));

describe('shopify-magic', () => {
  const nullLogger = () => {};
  const mockEditor = {
    document: {
      getText: vi.fn().mockReturnValue('some liquid code'),
      lineAt: vi.fn().mockReturnValue({ text: 'line text' }),
      fileName: 'snippets/test.liquid',
    },
    selection: {
      isEmpty: true,
    },
  } as unknown as TextEditor;

  const mockModel = {
    sendRequest: vi.fn(),
  } as any;

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('getShopifyMagicAnalysis', () => {
    it('should return empty array when no language model is available', async () => {
      vi.mocked(lm.selectChatModels).mockResolvedValue([]);

      const result = await getShopifyMagicAnalysis(mockEditor, nullLogger);

      expect(result).toEqual([]);
    });

    it('should return empty array when language model throws error', async () => {
      vi.mocked(lm.selectChatModels).mockResolvedValue([mockModel]);
      vi.mocked(mockModel.sendRequest).mockRejectedValue(new Error('Model error'));

      const result = await getShopifyMagicAnalysis(mockEditor, nullLogger);

      expect(result).toEqual([]);
    });

    it('should return empty array when response is invalid', async () => {
      vi.mocked(lm.selectChatModels).mockResolvedValue([mockModel]);
      vi.mocked(mockModel.sendRequest).mockResolvedValue({
        text: [JSON.stringify({ invalid: 'response' })],
      });

      const result = await getShopifyMagicAnalysis(mockEditor, nullLogger);

      expect(result).toEqual([]);
    });

    it('should return decorations for valid suggestions', async () => {
      const mockSuggestions = {
        suggestions: [
          {
            line: 1,
            range: { start: { line: 1 }, end: { line: 1 } },
            newCode: 'improved code',
            suggestion: 'make it better',
          },
        ],
      };

      vi.mocked(lm.selectChatModels).mockResolvedValue([mockModel]);
      vi.mocked(mockModel.sendRequest).mockResolvedValue({
        text: [JSON.stringify(mockSuggestions)],
      });

      const result = await getShopifyMagicAnalysis(mockEditor, nullLogger);

      expect(result).toEqual([
        {
          type: { key: 'mock-key' },
          options: {
            range: {
              start: {
                line: { line: 0, character: 0 },
                character: { line: 0, character: 9 },
              },
              end: {
                line: undefined,
                character: undefined,
              },
            },
            hoverMessage: {
              value: expect.stringContaining('Shopify Magic suggestion'),
              isTrusted: true,
              supportThemeIcons: true,
              supportHtml: true,
            },
          },
        },
      ]);
      expect(window.createTextEditorDecorationType).toHaveBeenCalled();
    });
  });
});
