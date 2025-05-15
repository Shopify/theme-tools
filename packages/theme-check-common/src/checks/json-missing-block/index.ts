import { getSchemaFromJSON } from '../../to-schema';
import { JSONCheckDefinition, Severity, SourceCodeType } from '../../types';
import { getAllBlocks, isPropertyNode } from './missing-block-utils';

export const JSONMissingBlock: JSONCheckDefinition = {
  meta: {
    code: 'JSONMissingBlock',
    name: 'Check for missing blocks types in JSON templates',
    docs: {
      description: 'This check ensures that JSON templates contain valid block types.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/json-missing-block',
    },
    type: SourceCodeType.JSON,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    if (!relativePath.startsWith('templates/')) return {};

    return {
      async onCodePathEnd() {
        const schema = await getSchemaFromJSON(context);
        const { ast } = schema ?? {};
        if (!ast || ast instanceof Error) return;
        if (!schema) return;

        const sections = schema.parsed.sections;
        if (!sections) return;

        await Promise.all(
          Object.entries(sections).map(async ([sectionKey, section]) => {
            if (
              isPropertyNode(section) &&
              'blocks' in section &&
              isPropertyNode(section.blocks) &&
              'type' in section
            ) {
              await getAllBlocks(
                ast,
                0,
                section.type,
                section.blocks,
                ['sections', sectionKey, 'blocks'],
                context,
              );
            }
          }),
        );
      },
    };
  },
};
