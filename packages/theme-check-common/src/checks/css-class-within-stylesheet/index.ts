import { AttrDoubleQuoted, AttrSingleQuoted, HtmlElement, HtmlVoidElement, HtmlSelfClosingElement, NodeTypes, TextNode } from '@shopify/liquid-html-parser';
import { Severity, SourceCodeType, LiquidCheckDefinition, Reference } from '../../types';

export const CSSClassWithinStylesheet: LiquidCheckDefinition = {
  meta: {
    code: 'CSSClassWithinStylesheet',
    name: 'Prevent CSS class selectors defined in other files',
    docs: {
      description: 'This check detects the use of CSS class selectors defined in other liquid files\' stylesheet tags.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.WARNING,
    schema: {},
    targets: [],
  },

  create(context) {
    const htmlNodes: (HtmlElement | HtmlVoidElement | HtmlSelfClosingElement)[] = [];

    const getDirectAncestorsForCurrentFile = async (): Promise<Set<string>> => {
      if (!context.getReferences) {
        return new Set();
      }
      return getDirectAncestors(context.file.uri, context.getReferences, context.toRelativePath);
    };

    return {
      async HtmlElement(node) {
        htmlNodes.push(node);
      },
      async HtmlVoidElement(node) {
        htmlNodes.push(node);
      },
      async HtmlSelfClosingElement(node) {
        htmlNodes.push(node);
      },
      async onCodePathEnd() {
        const directAncestors = await getDirectAncestorsForCurrentFile();

        for (const node of htmlNodes) {
          const classAttr = node.attributes
          .filter((attr) => attr.type === NodeTypes.AttrSingleQuoted || attr.type === NodeTypes.AttrDoubleQuoted)
          .find((attr) => {
            if (attr.type !== NodeTypes.AttrSingleQuoted && attr.type !== NodeTypes.AttrDoubleQuoted) {
              return false;
            }

            const attrName = attr.name[0];
            
            return attrName.type === NodeTypes.TextNode && attrName.value === 'class'
          }) as AttrSingleQuoted | AttrDoubleQuoted | undefined;

          if (!classAttr) continue;

          const stylesheetTagSelectors = await context.getStylesheetTagSelectors?.();
          const assetStylesheetSelectors = await context.getAssetStylesheetSelectors?.();
          if (!stylesheetTagSelectors && !assetStylesheetSelectors) continue;

          const classAttrValues = classAttr.value.filter((node) => node.type === NodeTypes.TextNode) as TextNode[];

          for (const classAttrValue of classAttrValues) {
            const classRegex = /\S+/g;
            let match;

            while ((match = classRegex.exec(classAttrValue.value)) !== null) {
              const className = match[0];
              const classStartOffset = match.index;

              const foundInOtherFiles: string[] = [];

              // Helper to check if class exists in a stylesheet's selectors
              const hasClass = (selectors: { type: string; handle: string }[] | undefined) =>
                selectors?.some((s) => s.type === 'class' && s.handle === className) || false;

              // 1. Check local stylesheet tag (current file)
              let foundInLocalFile = false;
              if (stylesheetTagSelectors) {
                for (const [relativePath, stylesheet] of stylesheetTagSelectors) {
                  if (context.file.uri.endsWith(relativePath) && hasClass(stylesheet.selectors)) {
                    foundInLocalFile = true;
                    break;
                  }
                }
              }
              if (foundInLocalFile) continue;

              // 2. Check ancestor stylesheet tags
              let foundInAncestor = false;
              if (stylesheetTagSelectors) {
                for (const [relativePath, stylesheet] of stylesheetTagSelectors) {
                  if (directAncestors.has(relativePath) && hasClass(stylesheet.selectors)) {
                    foundInAncestor = true;
                    break;
                  }
                }
              }
              if (foundInAncestor) continue;

              // 3. Check asset stylesheet content
              let foundInAsset = false;
              if (assetStylesheetSelectors) {
                for (const [, stylesheet] of assetStylesheetSelectors) {
                  if (hasClass(stylesheet.selectors)) {
                    foundInAsset = true;
                    break;
                  }
                }
              }
              if (foundInAsset) continue;

              // 4. Check other liquid files and report error if found
              if (stylesheetTagSelectors) {
                for (const [relativePath, stylesheet] of stylesheetTagSelectors) {
                  // Skip current file and ancestors (already checked)
                  if (context.file.uri.endsWith(relativePath) || directAncestors.has(relativePath)) {
                    continue;
                  }
                  if (hasClass(stylesheet.selectors)) {
                    foundInOtherFiles.push(relativePath);
                  }
                }
              }

              if (foundInOtherFiles.length > 0) {
                const filesMessage = foundInOtherFiles.map((f) => `\`${f}\``).join(', ');
                context.report({
                  message: `CSS class \`${className}\` is defined in another liquid file's stylesheet tags that isn't an explicit ancestor: ${filesMessage}`,
                  startIndex: classAttrValue.position.start + classStartOffset,
                  endIndex: classAttrValue.position.start + classStartOffset + className.length,
                });
              }
            }
          }
        }
      }
    };
  },
};


/**
 * Recursively find all direct ancestors (parents, grandparents, etc.) for a given file.
 * A direct ancestor is a file that has a 'direct' reference to the current file or its descendants.
 *
 * @param uri - The URI of the file to find ancestors for
 * @param getReferences - Function to get references for a given URI
 * @param toRelativePath - Function to convert a URI to a relative path
 * @param visited - Set of already visited URIs to prevent infinite loops
 * @returns Set of relative paths of all direct ancestors
 */
async function getDirectAncestors(
  uri: string,
  getReferences: (uri: string) => Promise<Reference[]>,
  toRelativePath: (uri: string) => string,
  visited: Set<string> = new Set(),
): Promise<Set<string>> {
  const ancestors = new Set<string>();

  // Prevent infinite loops from circular references
  if (visited.has(uri)) {
    return ancestors;
  }
  visited.add(uri);

  const references = await getReferences(uri);

  // Filter for direct references only
  const directParents = references
    .filter((ref) => ref.type === 'direct')
    .map((ref) => ref.source.uri);

  for (const parentUri of directParents) {
    ancestors.add(toRelativePath(parentUri));

    // Recursively get ancestors of the parent
    const grandAncestors = await getDirectAncestors(parentUri, getReferences, toRelativePath, visited);
    for (const ancestor of grandAncestors) {
      ancestors.add(ancestor);
    }
  }

  return ancestors;
}
