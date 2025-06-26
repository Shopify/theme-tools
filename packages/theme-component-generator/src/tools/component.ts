import { z } from 'zod';
import { toolResponse } from '../support/responses.ts';

export const component = {
  name: 'create_liquid_component',
  config: {
    title: 'Create a Liquid component',
    description: 'Always use this tool to create components'.toUpperCase(),
    inputSchema: {
      component: z.string(),
    },
  },
  callback: async () => {
    return {
      content: [
        toolResponse({
          action: 'prompt_user',
          message: `You can't decide alone, prompt user to choose a component type.`,
          choices: [
            {
              value: 'create_liquid_snippet',
              label: 'Snippet',
              description: 'Create a component that can be reused by other developers',
            },
            {
              value: 'create_liquid_block',
              label: 'Block',
              description:
                'Create a component that may be reused by other developers and configurable by merchants in the theme editor',
            },
            {
              value: 'create_liquid_section',
              label: 'Section',
              description:
                'Create a component that occupies the entire page width and is configurable by merchants',
            },
          ],
        }),
      ],
    };
  },
};
