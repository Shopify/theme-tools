import { asError } from './utils';
import { parse, ParseError } from 'jsonc-parser';

const PARSE_OPTS = {
  disallowComments: false,
  allowTrailingComma: true,
  allowEmptyContent: false,
};

export function parseJSON(source: string): any | Error;
export function parseJSON(source: string, defaultValue: any): any;
export function parseJSON(source: string, defaultValue?: any): any | Error {
  try {
    /**
     * The jsonc-parser is fault-tolerant and typically returns a valid
     * result. However, it also mutates the 'errors' array with any
     * errors it encounters during parsing.
     */
    const errors: ParseError[] = [];
    const result = parse(source, errors, PARSE_OPTS);

    if (errors.length) {
      throw errors[0];
    }

    return result;
  } catch (error) {
    if (defaultValue !== undefined) return defaultValue;
    return asError(error);
  }
}
