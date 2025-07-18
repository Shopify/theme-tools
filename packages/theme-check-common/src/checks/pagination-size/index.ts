import {
  LiquidRawTag,
  LiquidTag,
  LiquidVariableLookup,
  NodeTypes,
} from '@shopify/liquid-html-parser';
import { LiquidCheckDefinition, SchemaProp, Severity, SourceCodeType } from '../../types';
import { isError, last } from '../../utils';
import { isNodeOfType } from '../utils';
import { parseJSON } from '../../json';

const schema = {
  minSize: SchemaProp.number(1),
  maxSize: SchemaProp.number(250),
};

export const PaginationSize: LiquidCheckDefinition<typeof schema> = {
  meta: {
    code: 'PaginationSize',
    name: 'Ensure paginate tags are used with performant sizes',
    docs: {
      description: 'This check is aimed at keeping response times low.',
      url: 'https://shopify.dev/docs/storefronts/themes/tools/theme-check/checks/pagination-size',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema,
    targets: [],
  },

  create(context) {
    const minSize = context.settings.minSize;
    const maxSize = context.settings.maxSize;
    let schemaSettings: any[] = [];
    const pageSizeLookups: LiquidVariableLookup[] = [];

    function checkPageSize(
      pageSizeNode: any,
      value: number,
      message: string = `Pagination size must be a positive integer between ${minSize} and ${maxSize}.`,
    ) {
      if (minSize <= value && value <= maxSize) return;
      context.report({
        message,
        startIndex: pageSizeNode.position.start,
        endIndex: pageSizeNode.position.end,
      });
    }

    return {
      async LiquidTag(node: LiquidTag) {
        if (typeof node.markup === 'string' || node.name !== 'paginate') return;

        const pageSizeNode = node.markup.pageSize;

        if (isNodeOfType(NodeTypes.VariableLookup, pageSizeNode)) {
          pageSizeLookups.push(pageSizeNode);
        } else if (isNodeOfType(NodeTypes.Number, pageSizeNode)) {
          checkPageSize(pageSizeNode, Number(pageSizeNode.value));
        }
      },

      async LiquidRawTag(node: LiquidRawTag) {
        if (node.name === 'schema') {
          const schema = parseJSON(node.body.value);
          if (isError(schema)) return;
          if (schema.settings && Array.isArray(schema.settings)) {
            schemaSettings = schema.settings;
          }
        }
      },

      async onCodePathEnd() {
        pageSizeLookups.forEach((pageSizeVariableLookup) => {
          // Kind of assumes that you're using settings of some sort.
          const lastLookup = last(pageSizeVariableLookup.lookups);
          if (lastLookup === undefined) return;
          if (lastLookup.type !== NodeTypes.String) return;

          const settingId = lastLookup.value;
          const setting = schemaSettings.find((setting) => setting.id === settingId);

          if (setting === undefined) return;

          if (setting.default === undefined) {
            context.report({
              message: `Default pagination size should be defined in the section settings.`,
              startIndex: pageSizeVariableLookup.position.start,
              endIndex: pageSizeVariableLookup.position.end,
            });
            return;
          }

          checkPageSize(
            pageSizeVariableLookup,
            setting.default,
            `This setting's default value should be between ${minSize} and ${maxSize} but is currently ${setting.default}.`,
          );
        });
      },
    };
  },
};
