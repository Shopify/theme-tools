import { themeLiquidDocs } from '../support/docs.ts';
import { toolResponse } from '../support/responses.ts';

export const section = {
  name: 'create_liquid_section',
  config: {
    title: 'Create Liquid Section',
    description: 'Create a Liquid section file for Shopify theme customization',
    inputSchema: {},
  },
  callback: async () => {
    return {
      content: [
        toolResponse({
          action: 'generate_files',
          job: `Generate a section file in the sections directory and the required dependencies, using the "liquidReference" and "themesReference".`,
          liquidReference: themeLiquidDocs.data,
          themesReference: themeLiquidDocs.ai.themeArchitecture,
        }),
      ],
    };
  },
};
