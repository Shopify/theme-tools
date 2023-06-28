import parseToAst, { Location } from 'json-to-ast';
import { LiquidCheckDefinition, Severity, SourceCodeType, isPropertyNode } from '../../types';

import { buildValidator } from '../../utils/build-json-validator';
import { findNodeAtPath } from './find-node-at-path';
import { parseJsonBody, JsonParseError } from './parse-json-body';

// TODO: Replace this local static section schema with a json schema that is dependency injected
import sectionSchemaSchema from './temp-json-schema.json';

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

    // Setting strictTypes to false allows us to validate "default" as a keyword without warnings
    const validateSectionSchema = buildValidator(sectionSchemaSchema, { strictTypes: false });

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
           * Blocks for flex-sections, will use the schema tag and a similar yet different schema format.
           * The JSON schema validation is not quite applicable to flex-sections.
           *
           * TODO: We should support this case with its own bespoke JSON schema validation once
           * blocks liquid schemas is finalized and documented.
           */
          return;
        }

        // Otherwise the schema is syntactically valid and we can perform further validation on the contents
        const errors = validateSectionSchema(body);

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
