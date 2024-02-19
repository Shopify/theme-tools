import parseToAst, { Location } from 'json-to-ast';
import { LiquidCheckDefinition, Severity, SourceCodeType, isPropertyNode } from '../../types';

import { withErrorFormatting } from '../../utils/json-schema-validate-utils';
import { findNodeAtPath } from './find-node-at-path';
import { parseJsonBody, JsonParseError } from './parse-json-body';

export const ValidSchema: LiquidCheckDefinition = {
  meta: {
    code: 'ValidSchema',
    name: 'Prevent invalid JSON in {% schema %} tags',
    docs: {
      description: 'This check is aimed at eliminating JSON errors in schema tags.',
      recommended: true,
      url: 'https://shopify.dev/docs/themes/tools/theme-check/checks/valid-schema',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const filePath = context.file.absolutePath;
    const isSectionsDir = filePath.includes('/sections/');

    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema') {
          return;
        }
        if (node.body.kind !== 'json') {
          return;
        }

        const body = parseJsonBody(node);

        if (body instanceof JsonParseError) {
          return context.report({
            message: `Invalid syntax in schema JSON: ${body.message}`,
            startIndex: body.position.start,
            endIndex: body.position.end,
          });
        }

        if (!isSectionsDir) {
          /**
           * Blocks for flex-sections, will use the schema tag but a different format than validateSectionSchema.
           *
           * TODO: We should support this case with its own bespoke JSON schema validation once
           * blocks liquid schemas is finalized and documented.
           */
          return;
        }

        const validateSectionSchema = await context.jsonValidationSet?.validateSectionSchema();
        if (!validateSectionSchema) {
          return;
        }

        const validate = withErrorFormatting(validateSectionSchema);

        // Otherwise the schema is syntactically valid and we can perform further validation on the contents
        const errors = validate(body);

        const sectionSchemaAst = parseToAst(node.body.value, { loc: true });

        // Character index of the start of the schema block. ie: where the ast parsing begins.
        const schemaStartIndex = node.blockStartPosition.end;

        errors.map(({ path, message }) => {
          // Traverse the AST to find the node corresponding to the path
          const pathSegments = path.split('.');
          const node = findNodeAtPath(sectionSchemaAst, pathSegments);

          if (!node) {
            return;
          }

          let errorIndicies: {
            startIndex: number;
            endIndex: number;
          };
          if (isPropertyNode(node)) {
            const startLoc = node.key.loc as Location;
            const endLoc = node.value.loc as Location;

            errorIndicies = {
              startIndex: schemaStartIndex + startLoc.start.offset,
              endIndex: schemaStartIndex + endLoc.end.offset,
            };
          } else {
            const loc = node.loc as Location;

            errorIndicies = {
              startIndex: schemaStartIndex + loc.start.offset,
              endIndex: schemaStartIndex + loc.end.offset,
            };
          }

          context.report({
            message,
            ...errorIndicies,
          });
        });
      },
    };
  },
};
