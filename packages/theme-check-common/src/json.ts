import { asError } from './utils';

export function parseJSON(source: string): any | Error;
export function parseJSON(source: string, defaultValue: any): any;
export function parseJSON(source: string, defaultValue?: any): any | Error {
  try {
    return JSON.parse(source);
  } catch (error) {
    if (defaultValue !== undefined) return defaultValue;
    return asError(error);
  }
}
