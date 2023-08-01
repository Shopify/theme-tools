import type { ValidateFunction } from '../types';

const getLastToken = (inputString: string): string => {
  const tokens = inputString.split('/');
  return tokens[tokens.length - 1];
};

export interface SchemaError {
  path: string;
  message: string;
}

/**
 * Wraps a json schema validator with formatted error messages for rendering
 */
export const withErrorFormatting = (validate: ValidateFunction) => {
  return (sectionSchema: object): SchemaError[] => {
    validate(sectionSchema);

    const errors = validate.errors ?? [];

    return errors.map(({ instancePath, message }) => {
      const path = instancePath.replace(/^\//, '').replace(/\//gm, '.');
      return { path, message: `${getLastToken(instancePath)} ${message}` };
    });
  };
};
