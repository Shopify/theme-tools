import {
  BLOCK_CONTENT_PARAMETER,
  type BlockParameter,
  type BlockParameters,
  liquidDocType,
} from '../../block-parameters';
import { nodeAtPath } from '../../json';
import { BasicParamTypes, inferArgumentType, isTypeCompatible } from '../../liquid-doc/utils';
import * as path from '../../path';
import { schemaSettingLiquidType } from '../../schema-settings';
import { isBlock } from '../../to-schema';
import {
  Severity,
  SourceCodeType,
  type Context,
  type LiquidCheckDefinition,
  type ThemeBlockSchema,
} from '../../types';
import { reportWarning } from '../../utils';
import { blockTagSyntaxError } from '../liquid-syntax-error/block';
import {
  NodeTypes,
  type BlockArrayLiteral,
  type BlockMarkup,
  type LiquidDocParamNode,
  type LiquidExpression,
} from '@shopify/liquid-html-parser';

export const ValidBlockArgumentTypes: LiquidCheckDefinition = {
  meta: {
    code: 'ValidBlockArgumentTypes',
    name: 'Valid Block Argument Types',
    docs: {
      description:
        'Reports type mismatches in block arguments and declarations from schema, LiquidDoc, and built-in content.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-block-argument-types',
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const currentBlockName = isBlock(context.file.uri)
      ? path.basename(context.file.uri, '.liquid')
      : undefined;
    let currentParameters: Promise<BlockParameters | undefined> | undefined;

    return {
      async LiquidTag(node) {
        if (node.name !== 'block') return;
        if (blockTagSyntaxError(node)) return;

        const markup = node.markup as BlockMarkup;
        const parameters = await context.getBlockParameters(markup.name.value);
        if (!parameters) return;

        for (const argument of markup.args) {
          const expectedType = parameters.get(argument.name)?.type;
          const actualType = literalType(argument.value);
          if (!expectedType || !actualType || isCallTypeCompatible(expectedType, actualType)) {
            continue;
          }

          context.report({
            message: `Type mismatch for argument '${argument.name}': expected ${expectedType}, got ${actualType}`,
            startIndex: argument.value.position.start,
            endIndex: argument.value.position.end,
          });
        }
      },

      async LiquidDocParamNode(node) {
        if (!currentBlockName) return;

        currentParameters ??= context.getBlockParameters(currentBlockName);
        const parameter = (await currentParameters)?.get(node.paramName.value);
        if (!parameter) return;

        reportLiquidDocTypeMismatch(context, node, parameter);
      },

      async LiquidRawTag(node) {
        if (node.name !== 'schema' || node.body.kind !== 'json') return;
        if (!currentBlockName || !context.getBlockSchema) return;

        reportContentSettingTypeMismatch(context, await context.getBlockSchema(currentBlockName));
      },
    };
  },
};

/**
 * Infers the type of a literal argument value. Lookups and empty or partly
 * unknown arrays return undefined so they are never reported.
 */
function literalType(value: LiquidExpression | BlockArrayLiteral): string | undefined {
  if (value.type === NodeTypes.VariableLookup) return undefined;
  if (value.type !== 'BlockArrayLiteral') return inferArgumentType(value);

  const elementTypes = new Set(value.elements.map(literalType));
  if (elementTypes.size === 0 || elementTypes.has(undefined)) return undefined;

  return elementTypes.size === 1 ? `${[...elementTypes][0]}[]` : 'mixed[]';
}

/**
 * `object` accepts any literal. Ranges and arrays match only the same type.
 * Other scalars use the LiquidDoc rules, where `boolean` accepts any scalar.
 */
function isCallTypeCompatible(expectedType: string, actualType: string): boolean {
  if (expectedType === BasicParamTypes.Object) return true;
  if (actualType === BasicParamTypes.Object || actualType.endsWith('[]')) {
    return expectedType === actualType;
  }

  return isTypeCompatible(expectedType, actualType as BasicParamTypes);
}

function reportLiquidDocTypeMismatch(
  context: Context<SourceCodeType.LiquidHtml>,
  node: LiquidDocParamNode,
  parameter: BlockParameter,
): void {
  const declaredType = liquidDocType(node.paramType?.value);
  const authoritativeType = declarationType(parameter);
  if (!node.paramType || !declaredType || !authoritativeType) return;
  if (declaredType === BasicParamTypes.Object || declaredType === authoritativeType) return;

  const source = parameter.schemaSetting ? 'schema setting' : 'built-in parameter';
  context.report({
    message:
      `The ${source} '${parameter.name}' has Liquid type '${authoritativeType}', ` +
      `but LiquidDoc declares '${declaredType}'. The ${source} type is authoritative.`,
    startIndex: node.paramType.position.start - 1,
    endIndex: node.paramType.position.end + 1,
  });
}

/** Returns the merged type that a schema or built-in declaration must fit. */
function declarationType(parameter: BlockParameter): string | undefined {
  if (!parameter.schemaSetting && parameter.name !== BLOCK_CONTENT_PARAMETER) return undefined;
  return parameter.type;
}

function reportContentSettingTypeMismatch(
  context: Context<SourceCodeType.LiquidHtml>,
  schema: ThemeBlockSchema | undefined,
): void {
  if (!schema || schema.validSchema instanceof Error || schema.ast instanceof Error) return;

  const settings = schema.validSchema.settings ?? [];
  const index = settings.findIndex((setting) => setting.id === BLOCK_CONTENT_PARAMETER);
  if (index < 0) return;

  const settingType = schemaSettingLiquidType(settings[index].type);
  const typeNode = nodeAtPath(schema.ast, ['settings', index, 'type']);
  if (!settingType || settingType === 'string' || !typeNode) return;

  reportWarning(
    `Schema setting 'content' has Liquid type '${settingType}', but the built-in 'content' parameter has type 'string'.`,
    schema.offset,
    typeNode,
    context,
  );
}
