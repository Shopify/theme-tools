/**
 * Helper methods shared between `render` tag and `content_for` tag to report
 * errors when LiquidDoc exists
 */
import {
  ContentForMarkup,
  RenderMarkup,
  LiquidNamedArgument,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { Context, LiquidDocParameter, SourceCodeType, StringCorrector } from '..';
import {
  BasicParamTypes,
  getDefaultValueForType,
  inferArgumentType,
  isTypeCompatible,
} from './utils';
import { isLiquidString } from '../checks/utils';

/**
 * Report error when unknown arguments are provided for `content_for` tag or `render` tag
 */
export function reportUnknownArguments(
  context: Context<SourceCodeType.LiquidHtml>,
  node: ContentForMarkup | RenderMarkup,
  unknownProvidedArgs: LiquidNamedArgument[],
  name: string,
) {
  let errorOwnerMessage = '';
  if (node.type === NodeTypes.ContentForMarkup) {
    errorOwnerMessage = ` in content_for tag for static block '${name}'`;
  } else if (node.type === NodeTypes.RenderMarkup) {
    errorOwnerMessage = ` in render tag for snippet '${name}'`;
  }

  for (const arg of unknownProvidedArgs) {
    context.report({
      message: `Unknown argument '${arg.name}'${errorOwnerMessage}.`,
      startIndex: arg.position.start,
      endIndex: arg.position.end,
      suggest: [
        {
          message: `Remove '${arg.name}'`,
          fix: makeRemoveArgumentCorrector(node, arg),
        },
      ],
    });
  }
}

/**
 * Report error when missing arguments are provided for `content_for` tag or `render` tag
 */
export function reportMissingArguments(
  context: Context<SourceCodeType.LiquidHtml>,
  node: ContentForMarkup | RenderMarkup,
  missingRequiredArgs: LiquidDocParameter[],
  name: string,
) {
  let errorOwnerMessage = '';
  if (node.type === NodeTypes.ContentForMarkup) {
    errorOwnerMessage = ` in content_for tag for static block '${name}'`;
  } else if (node.type === NodeTypes.RenderMarkup) {
    errorOwnerMessage = ` in render tag for snippet '${name}'`;
  }

  for (const arg of missingRequiredArgs) {
    context.report({
      message: `Missing required argument '${arg.name}'${errorOwnerMessage}.`,
      startIndex: node.position.start,
      endIndex: node.position.end,
      suggest: [
        {
          message: `Add required argument '${arg.name}'`,
          fix: makeAddArgumentCorrector(node, arg),
        },
      ],
    });
  }
}

export function reportDuplicateArguments(
  context: Context<SourceCodeType.LiquidHtml>,
  node: ContentForMarkup | RenderMarkup,
  duplicateArgs: LiquidNamedArgument[],
  name: string,
) {
  let errorOwnerMessage = '';
  if (node.type === NodeTypes.ContentForMarkup) {
    errorOwnerMessage = ` in content_for tag for static block '${name}'`;
  } else if (node.type === NodeTypes.RenderMarkup) {
    errorOwnerMessage = ` in render tag for snippet '${name}'`;
  }

  for (const arg of duplicateArgs) {
    context.report({
      message: `Duplicate argument '${arg.name}'${errorOwnerMessage}.`,
      startIndex: arg.position.start,
      endIndex: arg.position.end,
      suggest: [
        {
          message: `Remove duplicate argument '${arg.name}'`,
          fix: makeRemoveArgumentCorrector(node, arg),
        },
      ],
    });
  }
}

/**
 * Find type mismatch between the arguments provided for `content_for` tag and `render` tag
 * and their associated file's LiquidDoc
 */
export function findTypeMismatchParams(
  liquidDocParameters: Map<string, LiquidDocParameter>,
  providedParams: LiquidNamedArgument[],
) {
  const typeMismatchParams: LiquidNamedArgument[] = [];

  for (const arg of providedParams) {
    if (arg.value.type === NodeTypes.VariableLookup) {
      continue;
    }

    const liquidDocParamDef = liquidDocParameters.get(arg.name);
    if (liquidDocParamDef && liquidDocParamDef.type) {
      const paramType = liquidDocParamDef.type.toLowerCase();
      const supportedTypes = Object.keys(BasicParamTypes).map((type) => type.toLowerCase());
      if (!supportedTypes.includes(paramType)) {
        continue;
      }

      if (!isTypeCompatible(paramType, inferArgumentType(arg.value))) {
        typeMismatchParams.push(arg);
      }
    }
  }

  return typeMismatchParams;
}

/**
 * Report error if the type mismatches between LiquidDoc and provided arguments
 */
export function reportTypeMismatches(
  context: Context<SourceCodeType.LiquidHtml>,
  typeMismatchArgs: LiquidNamedArgument[],
  liquidDocParameters: Map<string, LiquidDocParameter>,
) {
  for (const arg of typeMismatchArgs) {
    const paramDef = liquidDocParameters.get(arg.name);
    if (!paramDef || !paramDef.type) continue;

    const expectedType = paramDef.type.toLowerCase();
    const actualType = inferArgumentType(arg.value);

    const suggestions = generateTypeMismatchSuggestions(
      expectedType,
      arg.value.position.start,
      arg.value.position.end,
    );

    context.report({
      message: `Type mismatch for argument '${arg.name}': expected ${expectedType}, got ${actualType}`,
      startIndex: arg.value.position.start,
      endIndex: arg.value.position.end,
      suggest: suggestions,
    });
  }
}

/**
 * Generates suggestions for type mismatches based on the expected type and node positions
 */
export function generateTypeMismatchSuggestions(
  expectedType: string,
  startPosition: number,
  endPosition: number,
) {
  const defaultValue = getDefaultValueForType(expectedType);
  const suggestions = [];

  // Only add the "replace with default" suggestion if the default is not an empty string
  if (defaultValue !== '') {
    suggestions.push({
      message: `Replace with default value '${defaultValue}' for ${expectedType}`,
      fix: (fixer: StringCorrector) => {
        return fixer.replace(startPosition, endPosition, defaultValue);
      },
    });
  }

  // Always include the "remove value" suggestion
  suggestions.push({
    message: `Remove value`,
    fix: (fixer: StringCorrector) => {
      return fixer.remove(startPosition, endPosition);
    },
  });

  return suggestions;
}

function isLastArg(node: RenderMarkup | ContentForMarkup, arg: LiquidNamedArgument): boolean {
  return (
    node.args.length == 1 || arg.position.start == node.args[node.args.length - 1].position.start
  );
}

export function getBlockName(node: ContentForMarkup) {
  if (node.contentForType.value !== 'block') {
    return;
  }

  const contentForTypeArg = node.args.find((arg) => arg.name == 'type')?.value;

  if (!contentForTypeArg || !isLiquidString(contentForTypeArg)) {
    return;
  }

  return contentForTypeArg.value;
}

export function getSnippetName(node: RenderMarkup) {
  if (!isLiquidString(node.snippet)) {
    return;
  }

  return node.snippet.value;
}

export async function getLiquidDocParams(
  context: Context<SourceCodeType.LiquidHtml>,
  relativePath: string,
) {
  const docDefinition = context.getDocDefinition && (await context.getDocDefinition(relativePath));

  if (!docDefinition?.liquidDoc?.parameters) {
    return;
  }

  return new Map(docDefinition.liquidDoc.parameters.map((p) => [p.name, p]));
}

export function makeRemoveArgumentCorrector(
  node: ContentForMarkup | RenderMarkup,
  arg: LiquidNamedArgument,
) {
  return (fixer: StringCorrector) => {
    const sourceBeforeArg = node.source.slice(node.position.start, arg.position.start);
    const matches = sourceBeforeArg.match(/,\s*/g);
    const lastCommaMatch = matches?.[matches.length - 1];
    let startPos = lastCommaMatch
      ? arg.position.start - (lastCommaMatch.length - 1)
      : arg.position.start;

    if (isLastArg(node, arg)) {
      // Remove the leading comma if it's the last parameter
      startPos -= 1;
    }

    const sourceAfterArg = node.source.substring(arg.position.end, node.position.end);
    const trailingCommaMatch = sourceAfterArg.match(/\s*,/);
    if (trailingCommaMatch) {
      return fixer.remove(startPos, arg.position.end + trailingCommaMatch[0].length);
    }
    return fixer.remove(startPos, arg.position.end);
  };
}

export function makeAddArgumentCorrector(
  node: ContentForMarkup | RenderMarkup,
  arg: LiquidDocParameter,
) {
  return (fixer: StringCorrector) => {
    const paramToAdd = `, ${arg.name}: ${getDefaultValueForType(arg.type)}`;

    if (node.args.length == 0) {
      return fixer.insert(node.position.end - 1, paramToAdd);
    }

    const lastArg = node.args[node.args.length - 1];
    const sourceAfterLastArg = node.source.substring(lastArg.position.end, node.position.end);

    const trailingCommaAndWhitespaceMatch = sourceAfterLastArg.match(/\s*,\s*/);
    if (trailingCommaAndWhitespaceMatch) {
      // IF there is already a trailing comma after the last arg, we want to find it and replace it with our own while stripping whitespace
      return fixer.replace(
        lastArg.position.end,
        lastArg.position.end + trailingCommaAndWhitespaceMatch[0].length,
        `${paramToAdd} `,
      );
    }

    return fixer.insert(lastArg.position.end, paramToAdd);
  };
}
