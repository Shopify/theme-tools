import { getDefaultValueForType, LiquidDocParameter } from '@shopify/theme-check-common';
import { SupportedDocTagTypes, BasicParamTypes } from '@shopify/theme-check-common';

export function formatLiquidDocParameter(
  { name, type, description, required }: LiquidDocParameter,
  heading: boolean = false,
) {
  const nameStr = required ? `\`${name}\`` : `\`${name}\` (Optional)`;
  const typeStr = type ? `: ${type}` : '';

  if (heading) {
    const descStr = description ? `\n\n${description}` : '';
    return `### ${nameStr}${typeStr}${descStr}`;
  }

  const descStr = description ? ` - ${description}` : '';
  return `- ${nameStr}${typeStr}${descStr}`;
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
      '- An optional parameter is denoted by square brackets around the parameter name\n' +
      '- The description is optional Markdown text',
    example:
      '{% doc %}\n' +
      "  @param {string} name - The person's name\n" +
      "  @param {number} [fav_num] - The person's favorite number\n" +
      "  @param {product} prod - The person's chosen product\n" +
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

  const valueTemplate = paramDefaultValue === "''" ? `'$1'$0` : `\${1:${paramDefaultValue}}$0`;

  return `${name}: ${valueTemplate}`;
}
