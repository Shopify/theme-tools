import { it, expect, describe, vi, afterEach, afterAll } from 'vitest';
import { showShopifyMagicButton, showShopifyMagicLoadingButton } from './ui';
import { commands } from 'vscode';
import { hasShopifyThemeLoaded } from './utils';

vi.mock('./utils');
vi.mock('vscode', async () => {
  return {
    commands: {
      executeCommand: vi.fn(),
    },
    workspace: {
      workspaceFolders: [
        {
          uri: { fsPath: '/mock/path' },
        },
      ],
      fs: {
        stat: vi.fn(),
      },
    },
  };
});

describe('ui', async () => {
  afterEach(vi.clearAllMocks);
  afterAll(vi.unstubAllGlobals);

  describe('showShopifyMagicButton', async () => {
    it('should show the magic button and hide the loading component when in a theme directory', async () => {
      vi.mocked(hasShopifyThemeLoaded).mockResolvedValue(true);

      await showShopifyMagicButton();

      const shopifyMagicButtton = 'shopifyLiquid.shopifyMagic.visible';
      const shopifyMagicLoading = 'shopifyLiquid.shopifyMagicLoading.visible';

      expect(commands.executeCommand).toBeCalledWith('setContext', shopifyMagicButtton, true);
      expect(commands.executeCommand).toBeCalledWith('setContext', shopifyMagicLoading, false);
    });

    it('should not update button visibility when not in a theme directory', async () => {
      vi.mocked(hasShopifyThemeLoaded).mockResolvedValue(false);

      await showShopifyMagicButton();

      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });

  describe('showShopifyMagicLoadingButton', async () => {
    it('should show the loading component and hide the magic button when in a theme directory', async () => {
      vi.mocked(hasShopifyThemeLoaded).mockResolvedValue(true);

      await showShopifyMagicLoadingButton();

      const shopifyMagicButton = 'shopifyLiquid.shopifyMagic.visible';
      const shopifyMagicLoading = 'shopifyLiquid.shopifyMagicLoading.visible';

      expect(commands.executeCommand).toBeCalledWith('setContext', shopifyMagicButton, false);
      expect(commands.executeCommand).toBeCalledWith('setContext', shopifyMagicLoading, true);
    });

    it('should not update button visibility when not in a theme directory', async () => {
      vi.mocked(hasShopifyThemeLoaded).mockResolvedValue(false);

      await showShopifyMagicLoadingButton();

      expect(commands.executeCommand).not.toHaveBeenCalled();
    });
  });
});
