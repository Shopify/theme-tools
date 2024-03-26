import { Severity, SourceCodeType, JSONCheckDefinition } from '../../types';
import { getOffset, isError } from '../../utils';

function cleanErrorMessage(error: Error) {
  const message = 'rawMessage' in error ? (error.rawMessage as string) : error.message;
  return message.replace(/\s+at \d+:\d+/, '');
}

export const ValidJSON: JSONCheckDefinition = {
  meta: {
    code: 'ValidJSON',
    aliases: ['ValidJson'],
    name: 'Enforce valid JSON',
    docs: {
      description:
        'This check exists to prevent invalid JSON files in themes. Will check against schema if available.',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/valid-json',
    },
    type: SourceCodeType.JSON,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    if (!context.validateJSON) return {};
    const validateJSON = context.validateJSON;

    return {
      async onCodePathStart(file) {
        const problems = await validateJSON(file, file.source);
        if (!problems) return;
        for (const problem of problems) {
          context.report(problem);
        }
      },
    };
  },
};
