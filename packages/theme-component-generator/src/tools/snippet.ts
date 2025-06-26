import { themeLiquidDocs } from '../support/docs.ts';
import { toolResponse } from '../support/responses.ts';

export const snippet = {
  name: 'create_liquid_snippet',
  config: {
    title: 'Create Liquid Snippet',
    description: 'Create a reusable Liquid snippet file for theme components',
    inputSchema: {},
  },
  callback: async () => {
    return {
      content: [
        toolResponse({
          action: 'generate_files',
          job: `Generate a snippet file in the snippets directory and the required dependencies, using the "liquidReference" and "themesReference".`,
          liquidReference: themeLiquidDocs.data,
          themesReference: themeLiquidDocs.ai.themeArchitecture,
        }),
      ],
    };
  },
};
