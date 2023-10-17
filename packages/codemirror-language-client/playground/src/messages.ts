import { Message, NotificationMessage } from 'vscode-languageserver-protocol';
import * as SetFileTreeNotification from './SetFileTreeNotification';
import * as SetDefaultTranslationsNotification from './SetDefaultTranslationsNotification';

export function isNotification(
  message: Message,
): message is NotificationMessage {
  return 'method' in message && !('id' in message);
}

export type ShopifyNotification =
  | SetFileTreeNotification.type
  | SetDefaultTranslationsNotification.type;

export function isDependencyInjectionMessage(
  message: Message,
): message is ShopifyNotification {
  return (
    isNotification(message) &&
    [
      SetFileTreeNotification.method,
      SetDefaultTranslationsNotification.method,
    ].includes(message.method)
  );
}
