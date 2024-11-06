import { parseJSON } from '../../json';
import { LiquidCheckDefinition, Severity, SourceCodeType } from '../../types';
import { isError } from '../../utils';
import type { ASTNode, ObjectASTNode } from 'vscode-json-languageservice';

const MAX_SCHEMA_NAME_LENGTH = 25;

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
                if (node.name !== 'schema' || node.body.kind !== 'json' || !context.parseJSON) {
                    return;
                }

                const schema = parseJSON(node.body.value); // TODO: replace with just the one parsing using content.parseJSON
                if (isError(schema) && schema instanceof SyntaxError) return;

                if (!schema.name.startsWith('t:') && schema.name.length > MAX_SCHEMA_NAME_LENGTH) {
                    const jsonString = node.source.slice(
                        node.blockStartPosition.end,
                        node.blockEndPosition.start,
                    );

                    const json = JSON.parse(jsonString);
                    const jsonDocument = context.parseJSON(context.file, jsonString);
                    if (!jsonDocument || !jsonDocument.root) {
                        return;
                    }
                    const jsonDocRoot = jsonDocument.root;
                    if (rootIsObjectAst(jsonDocRoot)) {
                        const nameProperty = jsonDocRoot.properties.find(property => property.keyNode.value === "name");

                        if (nameProperty) { //TODO: find returns -1, check docs
                            // const nameLength = nameProperty.keyNode.value.length;
                            // const nameOffset = nameProperty.keyNode.offset;
                            const nameLength = 4;
                            const nameOffset = 4;

                            console.log("Starts at ", node.blockStartPosition.end + nameOffset);
                            console.log("Ends at ", node.blockStartPosition.end + nameOffset + nameLength);

                            context.report({
                                message: 'Schema name is too long (max 25 characters)',
                                startIndex: node.blockStartPosition.end + nameOffset,
                                endIndex: node.blockStartPosition.end + nameOffset + nameLength,
                            });
                        }
                    }
                }
            },
        };
    },
};

function rootIsObjectAst(root: ASTNode): root is ObjectASTNode {
    return root.type === 'object' && 'properties' in root;
}