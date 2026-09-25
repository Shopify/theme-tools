import {
  BasicParamTypes,
  DocDefinition,
  getDefaultValueForType,
  LiquidDocParameter,
  parseStringEnumType,
  StringEnumType,
  SupportedDocTagTypes,
} from '@shopify/theme-check-common';

export function formatLiquidDocParameter(
  { name, type, description, required }: LiquidDocParameter,
  heading: boolean = false,
) {
  const nameStr = required ? `\`${name}\`` : `\`${name}\` (Optional)`;
  const typeStr = type ? `: ${formatLiquidDocParamType(type)}` : '';

  if (heading) {
    const descStr = description ? `\n\n${description}` : '';
    return `### ${nameStr}${typeStr}${descStr}`;
  }

  const descStr = description ? ` - ${description}` : '';
  return `- ${nameStr}${typeStr}${descStr}`;
}

export function formatLiquidDocParamType(type: string | StringEnumType): string {
  if (typeof type === 'string' && !parseStringEnumType(type)) return type;

  const annotation =
    typeof type === 'string' ? type.trim() : type.members.map((member) => member.raw).join(' | ');
  // Inferred literal values can span lines; display those line breaks explicitly.
  const display = annotation.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  const backticks = display.match(/`+/g) ?? [];
  const fenceLength = backticks.reduce((length, run) => Math.max(length, run.length + 1), 1);
  const fence = '`'.repeat(fenceLength);
  return `${fence}${display}${fence}`;
}

export function formatLiquidDocTagHandle(label: string, description: string, example: string) {
  return `### @${label}\n\n${description}\n\n` + `**Example**\n\n\`\`\`liquid\n${example}\n\`\`\``;
}

export const SUPPORTED_LIQUID_DOC_TAG_HANDLES = {
  [SupportedDocTagTypes.Param]: {
    description:
      'Provides information about a parameter for the snippet.\n' +
      `- The type of parameter is optional and can be ${Object.values(BasicParamTypes)
        .map((type) => `\`${type}\``)
        .join(', ')}\n` +
      ` or liquid object that isn't exclusively a global object in our [API Docs](https://shopify.dev/docs/api/liquid/objects)\n` +
      "- String values can be restricted to an enum, such as `{'heading' | 'small'}`\n" +
      '- An optional parameter is denoted by square brackets around the parameter name\n' +
      '- The description is optional Markdown text',
    example:
      '{% doc %}\n' +
      "  @param {string} name - The person's name\n" +
      "  @param {number} [fav_num] - The person's favorite number\n" +
      "  @param {product} prod - The person's chosen product\n" +
      "  @param {'heading' | 'small'} [variant] - The text style\n" +
      '{% enddoc %}\n',
    template: `param {$2} $1$0`,
  },
  [SupportedDocTagTypes.Example]: {
    description: 'Provides an example on how to use the snippet.',
    example:
      '{% doc %}\n' + '  @example {% render "snippet-name", arg1: "value" %}\n' + '{% enddoc %}\n',
    template: `example $0`,
  },
  [SupportedDocTagTypes.Description]: {
    description: 'Provides information on what the snippet does.',
    example:
      '{% doc %}\n' + '  @description This snippet renders a product image.\n' + '{% enddoc %}\n',
    template: `description $0`,
  },
};

export function getParameterCompletionTemplate(name: string, type: string | null) {
  const paramDefaultValue = getDefaultValueForType(type);
  const escapedDefaultValue = paramDefaultValue.replace(/[\\$}]/g, '\\$&');

  const valueTemplate = paramDefaultValue === "''" ? `'$1'$0` : `\${1:${escapedDefaultValue}}$0`;

  return `${name}: ${valueTemplate}`;
}

export function formatLiquidDocContentMarkdown(
  name: string,
  docDefinition?: DocDefinition,
): string {
  const liquidDoc = docDefinition?.liquidDoc;

  if (!liquidDoc) {
    return `### ${name}`;
  }

  const parts = [`### ${name}`];

  if (liquidDoc.description) {
    const description = liquidDoc.description.content;
    parts.push('', '**Description:**', '\n', description);
  }

  if (liquidDoc.parameters?.length) {
    const parameters = liquidDoc.parameters
      .map((param) => formatLiquidDocParameter(param))
      .join('\n');
    parts.push('', '**Parameters:**', parameters);
  }

  if (liquidDoc.examples?.length) {
    const examples = liquidDoc.examples
      ?.map(({ content }) => `\`\`\`liquid\n${content}\n\`\`\``)
      .join('\n');

    parts.push('', '**Examples:**', examples);
  }

  return parts.join('\n');
}
