import { LiquidDocParameter } from '@shopify/theme-check-common';

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
  param: {
    description:
      'Provides information about a parameter for the snippet.\n' +
      '- The type of parameter is optional and can be `string`, `number`, or `Object`.\n' +
      '- An optional parameter is denoted by square brackets around the parameter name.\n' +
      '- The description is optional Markdown text.',
    example:
      '{% doc %}\n' +
      "  @param {string} name - The person's name\n" +
      "  @param {number} [fav_num] - The person's favorite number\n" +
      '{% enddoc %}\n',
    template: `param {$1} $2 - $0`,
  },
  example: {
    description: 'Provides an example on how to use the snippet.',
    example:
      '{% doc %}\n' + '  @example {% render "snippet-name", arg1: "value" %}\n' + '{% enddoc %}\n',
    template: `example\n$0`,
  },
  description: {
    description: 'Provides information on what the snippet does.',
    example:
      '{% doc %}\n' + '  @description This snippet renders a product image.\n' + '{% enddoc %}\n',
    template: `description $0`,
  },
};
