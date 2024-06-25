import { LiquidCheckDefinition, Severity, SourceCodeType, isArrayNode } from '../../types';
import { isNodeOfType } from '../utils';
import { last } from '../../utils';
import { LiquidStatement, NodeTypes } from '@shopify/liquid-html-parser';

export const ShopPayInstallmentsBannerValidForm: LiquidCheckDefinition = {
  meta: {
    code: 'ShopPayInstallmentsBannerValidForm',
    name: 'Shop Pay Installments Banner Valid Form',
    docs: {
      description:
        'Identifies usage of the Shop Pay Installments banner within invalid form blocks.',
      url: '',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },


  create(context) {
    return {
      async LiquidVariable(node, ancestors) {
        if (node.filters.length === 0 || node.filters[0].name !== 'payment_terms') { // check all the filters or something
          return;
        }

        if (!isNodeOfType(NodeTypes.VariableLookup, node.expression)) {
          return;
        }

        if (node.expression.name !== "form") {
          context.report({
            message: "payment_terms filter must be applied with a reference to the form object. e.g. {{ form | payment_terms }}",
            startIndex: node.position.start,
            endIndex: node.position.end,
          });
        }

        const liquidVariableGrandParent = ancestors.reverse().find((ancestor) => {
          return isNodeOfType(NodeTypes.LiquidTag, ancestor) && ancestor.name === 'form';
        });

        if (!liquidVariableGrandParent) { return }

        const start = node.source.substring(liquidVariableGrandParent.position.start, liquidVariableGrandParent.position.end);

        if (!liquidVariableGrandParent || !isNodeOfType(NodeTypes.LiquidTag, liquidVariableGrandParent)) {
          return;
        }

        const markup = liquidVariableGrandParent.markup as LiquidStatement[]


        // if (!liquidVariableGrandParent.markup || typeof liquidVariableGrandParent.markup !== 'string' || isArrayNode(liquidVariableGrandParent) || liquidVariableGrandParent.markup.length === 0) {
        //   return;
        // }

        // if (markup[0].value !== "form") {
          // return;
        // }

        // "The payment_terms filter requires the form object from the Liquid product form or cart form."


        return;
      }

    };
  },
};
