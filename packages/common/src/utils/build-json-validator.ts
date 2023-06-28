import Ajv, { Options } from 'ajv';

const getLastToken = (inputString: string): string => {
  const tokens = inputString.split('/');
  return tokens[tokens.length - 1];
};

export interface SchemaError {
  path: string;
  message: string;
}

export const buildValidator = (jsonSchema: any, options?: Options) => {
  const ajv = new Ajv({ allErrors: true, ...(options ?? {}) });
  const validate = ajv.compile(jsonSchema);

  return (sectionSchema: object): SchemaError[] => {
    validate(sectionSchema);

    const errors = validate.errors ?? [];

    return errors.map(({ instancePath, message }) => {
      const path = instancePath.replace(/^\//, '').replace(/\//gm, '.');
      return { path, message: `${getLastToken(instancePath)} ${message}` };
    });
  };
};
