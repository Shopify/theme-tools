// Here's an example "home made" Liquid check made in vanilla JavaScript
//
// You can use the TypeScript comments to help you write the code without
// having to depend on bundling.

// We import SourceCodeType and Severity for documentation purposes, you
// could use the values directly but it would make the code a bit more
// obscure to read.
const { SourceCodeType, Severity } = require('@shopify/theme-check-common');

// We import LiquidCheckDefinition to annotate the check. This will give
// us powerful type inference and completion suggestions in the body of the
// return value of the create function.
/** @typedef { import('@shopify/theme-check-common').LiquidCheckDefinition } LiquidCheckDefinition */

// We define a check. If you had many, you could split that into multiple
// files, but for now just one is good enough.
/** @type LiquidCheckDefinition */
const NoScriptTag = {
  meta: {
    code: 'NoScriptTag',
    name: 'No script tag',
    docs: { description: '...' },
    schema: {},
    severity: Severity.ERROR,
    targets: [],
    type: SourceCodeType.LiquidHtml,
  },

  create(context) {
    return {
      HtmlRawNode(node) {
        if (node.name === 'script') {
          context.report({
            message: 'NO SCRIPT TAGS!!',
            startIndex: node.position.start,
            endIndex: node.position.end,
          });
        }
      },
    };
  },
};

// This is where we make our checks available. When `exports.checks`
// is an array of checks, we'll pick them up for you.
exports.checks = [NoScriptTag];
