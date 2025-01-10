import {
  isArrayNode,
  isLiteralNode,
  isObjectNode,
  isPropertyNode,
  Severity,
  SourceCodeType,
} from '../../types';

import type { ArrayNode, PropertyNode, JSONCheckDefinition } from '../../types';

export const UniqueSettingIds: JSONCheckDefinition = {
  meta: {
    code: 'UniqueSettingId',
    name: 'Prevent duplicate Ids in setting_schema',
    docs: {
      description: 'This check is aimed at eliminating duplicate Ids in settings_schema.json',
      recommended: true,
      // url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/valid-schema',
    },
    type: SourceCodeType.JSON,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    return {
      async onCodePathEnd(file) {
        if (isArrayNode(file.ast)) {
          const settingIds: PropertyNode[] = [];

          /* Find and loop through all of our nodes that have an id value and find their key value */
          for (const child of file.ast.children) {
            if (isObjectNode(child) && child.children) {
              const settingsNode = child.children.find((node) => node.key.value === 'settings');

              if (settingsNode && settingsNode.value && isArrayNode(settingsNode.value)) {
                for (const setting of settingsNode.value.children) {
                  if (isObjectNode(setting) && setting.children) {
                    const idNode = setting.children.find((node) => node.key.value === 'id');
                    if (isPropertyNode(idNode)) {
                      settingIds.push(idNode);
                    }
                  }
                }
              }
            }
          }

          /* Check for dupes */
          const idMap = new Map<string, PropertyNode[]>();
          for (const node of settingIds) {
            if (isLiteralNode(node.value)) {
              const id = node.value.value;
              if (typeof id === 'string') {
                if (!idMap.has(id)) {
                  idMap.set(id, []);
                }
                idMap.get(id)!.push(node);
              }
            }
          }

          const duplicates: [string, PropertyNode[]][] = Array.from(idMap.entries()).filter(
            ([_, nodes]) => nodes.length > 1,
          );

          if (duplicates.length > 0) {
            for (const [id, nodes] of duplicates) {
              const lastNodeFound = nodes[nodes.length - 1];

              context.report({
                message: `Duplicate setting id found: "${id}"`,
                startIndex: lastNodeFound.loc.start.offset,
                endIndex: lastNodeFound.loc.end.offset,
              });
            }
          }
        }
      },
    };
  },
};
