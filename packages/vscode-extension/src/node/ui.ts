import { commands } from 'vscode';
import { hasShopifyThemeLoaded } from './utils';

/**
 * Displays the Shopify Magic button in the VS Code UI while hiding the loading
 * state button, only when executed within Shopify theme directories.
 */
export async function showShopifyMagicButton() {
  await setShopifyMagicVisibility(true);
}

/**
 * Displays the Shopify Magic loading button in the VS Code UI while hiding the
 * regular button, only when executed within Shopify theme directories.
 */
export async function showShopifyMagicLoadingButton() {
  await setShopifyMagicVisibility(false);
}

async function setShopifyMagicVisibility(showMagic: boolean) {
  const hasTheme = await hasShopifyThemeLoaded();

  if (!hasTheme) {
    return;
  }

  await Promise.all([
    commands.executeCommand('setContext', 'shopifyLiquid.shopifyMagic.visible', showMagic),
    commands.executeCommand('setContext', 'shopifyLiquid.shopifyMagicLoading.visible', !showMagic),
  ]);
}
