import { themeLiquidDocs } from '../support/docs.ts';
import { toolResponse } from '../support/responses.ts';

export const block = {
  name: 'create_liquid_block',
  config: {
    title: 'Create Liquid Block',
    description: 'Create a Liquid block file for modular theme content',
    inputSchema: {},
  },
  callback: async () => {
    return {
      content: [
        toolResponse({
          action: 'generate_files',
          job: `Generate a block file in the blocks directory and the required dependenciesusing the "liquidReference" and "themesReference"liquidReference and blocksReference.`,
          liquidReference: themeLiquidDocs.data,
          themesReference: themeLiquidDocs.ai.themeArchitecture,
        }),
      ],
    };
  },
};
