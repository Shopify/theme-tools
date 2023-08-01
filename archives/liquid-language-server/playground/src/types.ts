import { NotificationMessage } from 'vscode-jsonrpc';
import { Translations } from '@shopify/theme-check-common';
import { URI } from 'vscode-languageserver-types';

export interface SetFileTreeNofification extends NotificationMessage {
  method: 'shopify/setFileTree';
  params: URI[];
}

export function isSetFileTreeNotificationMessage(
  message: any,
): message is SetFileTreeNofification {
  return (
    message && 'method' in message && message.method === 'shopify/setFileTree'
  );
}

export interface SetDefaultTranslationsNotification
  extends NotificationMessage {
  method: 'shopify/setDefaultTranslations';
  params: Translations;
}

export function isSetDefaultTranslationsNotification(
  message: any,
): message is SetDefaultTranslationsNotification {
  return (
    message &&
    'method' in message &&
    message.method === 'shopify/setDefaultTranslations'
  );
}
