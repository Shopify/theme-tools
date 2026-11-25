import { getLocEnd, getLocStart, nodeAtPath } from '../../json';
import { getSchemaFromJSON } from '../../to-schema';
import { JSONCheckDefinition, Severity, SourceCodeType } from '../../types';
import { doesFileExist } from '../../utils/file-utils';

const SECTION_TYPES_WITH_PLATFORM_DEFAULTS = ['apps', '_blocks'];

export const JSONMissingSection: JSONCheckDefinition = {
  meta: {
    code: 'JSONMissingSection',
    name: 'Check for missing section files in JSON templates and section groups',
    docs: {
      description:
        'This check ensures that section types in JSON templates and section groups refer to existing section files.',
      recommended: true,
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/json-missing-section',
    },
    type: SourceCodeType.JSON,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const relativePath = context.toRelativePath(context.file.uri);
    const isJsonTemplate = relativePath.startsWith('templates/');
    const isSectionGroup = relativePath.startsWith('sections/');
    if (!isJsonTemplate && !isSectionGroup) return {};

    return {
      async onCodePathEnd() {
        const schema = await getSchemaFromJSON(context);
        const { ast } = schema ?? {};
        if (!ast || ast instanceof Error) return;

        const sectionsNode = nodeAtPath(ast, ['sections']);
        if (!sectionsNode || sectionsNode.type !== 'Object') return;

        await Promise.all(
          sectionsNode.children.map(async (property) => {
            const sectionNode = property.value;
            if (sectionNode.type !== 'Object') return;

            const typeNode = sectionNode.children.find(
              (child) => child.key.value === 'type',
            )?.value;
            if (!typeNode || typeNode.type !== 'Literal') return;

            const sectionType = typeNode.value;
            if (typeof sectionType !== 'string') return;
            if (SECTION_TYPES_WITH_PLATFORM_DEFAULTS.includes(sectionType)) return;

            const sectionFileExists = await doesFileExist(
              context,
              `sections/${sectionType}.liquid`,
            );
            if (sectionFileExists) return;

            context.report({
              message: `Section type '${sectionType}' does not refer to an existing section file`,
              startIndex: getLocStart(typeNode),
              endIndex: getLocEnd(typeNode),
            });
          }),
        );
      },
    };
  },
};
