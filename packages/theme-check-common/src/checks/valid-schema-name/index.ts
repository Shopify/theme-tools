import { LiteralNode, ValueNode } from 'json-to-ast';
import { parseJSON } from '../../json';
import { toJSONAST } from '../../to-source-code';
import { JSONNode, LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { visit } from '../../visitor';

const MAX_SCHEMA_NAME_LENGTH = 25;
const ROOT_NODE_ANCESTORS_COUNT = 1;

export const ValidSchemaName: LiquidCheckDefinition = {
  meta: {
    code: 'ValidSchemaName',
    name: 'Enforce valid schema name',
    docs: {
      description: 'This check is aimed at ensuring a valid schema name.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema-name',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') {
          return;
        }

        const jsonSchemaString = node.source.slice(
          node.blockStartPosition.end,
          node.blockEndPosition.start,
        );

        const jsonSchemaAst = toJSONAST(jsonSchemaString);

        const promises = visit<SourceCodeType.JSON, Promise<void>>(jsonSchemaAst as JSONNode, {
          async Property(nameNode, ancestors) {
            if (
              nameNode.key.value === 'name' &&
              ancestors.length === ROOT_NODE_ANCESTORS_COUNT &&
              isLiteralNode(nameNode.value)
            ) {
              const name = getLiteralValue(nameNode.value);
              const startIndex = node.blockStartPosition.end + getLiteralLocStart(nameNode.value);
              const endIndex = node.blockStartPosition.end + getLiteralLocEnd(nameNode.value);

              if (!name.startsWith('t:') && name.length > MAX_SCHEMA_NAME_LENGTH) {
                context.report({
                  message: `Schema name '${name}' is too long (max 25 characters)`,
                  startIndex: startIndex,
                  endIndex: endIndex,
                });
              }

              if (name.startsWith('t:')) {
                const defaultLocale = await context.getDefaultLocale();
                const key = name.replace('t:', '');
                const defaultTranslations = await context.getDefaultSchemaTranslations();
                const translation = getTranslation(key, defaultTranslations);

                if (translation === undefined) {
                  context.report({
                    message: `'${name}' does not have a matching entry in 'locales/${defaultLocale}.default.schema.json'`,
                    startIndex: startIndex,
                    endIndex: endIndex,
                  });
                }

                if (translation !== undefined && translation.length > MAX_SCHEMA_NAME_LENGTH) {
                  context.report({
                    message: `Schema name '${translation}' from 'locales/${defaultLocale}.default.schema.json' is too long (max 25 characters)`,
                    startIndex: startIndex,
                    endIndex: endIndex,
                  });
                }
              }
            }
          },
        });

        await Promise.all(promises);
      },
    };
  },
};

function isLiteralNode(node: ValueNode): node is LiteralNode {
  return node.type === 'Literal';
}

function getLiteralValue(node: LiteralNode): string {
  if (typeof node.value === 'string') {
    return node.value;
  }
  return '';
}

function getLiteralLocStart(node: LiteralNode): number {
  return node.loc?.start.offset ?? 0;
}

function getLiteralLocEnd(node: LiteralNode): number {
  return node.loc?.end.offset ?? 0;
}

function getTranslation(key: string, pointer: any) {
  for (const token of key.split('.')) {
    if (typeof pointer !== 'object') {
      return undefined;
    }

    if (!pointer.hasOwnProperty(token)) {
      return undefined;
    }

    pointer = pointer[token];
  }

  return pointer; //the last pointer is the translation
}
