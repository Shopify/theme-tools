import { LiquidHtmlNode, NodeTypes } from '@shopify/liquid-html-parser';
import { SourceCodeType, visit } from '@shopify/theme-check-common';
import {
  DefinitionLink,
  DefinitionParams,
  LocationLink,
  Range,
} from 'vscode-languageserver-protocol';
import { DocumentManager } from '../../documents';
import { BaseDefinitionProvider } from '../BaseDefinitionProvider';

interface AssignDefinition {
  /** The name of the variable being assigned */
  name: string;
  /** The offset of the start of the name within the assign markup */
  nameStart: number;
  /** The offset of the end of the name within the assign markup */
  nameEnd: number;
}

/**
 * Provides go-to-definition for Liquid variable references.
 *
 * When the cursor is on a `VariableLookup` (e.g. `{{ my_var }}`), this provider
 * finds the `{% assign my_var = ... %}` that defines it.
 *
 * For now, this only handles `assign` tags. Future expansion will add support
 * for `capture`, `for`, `tablerow`, and `@param`.
 */
export class VariableDefinitionProvider implements BaseDefinitionProvider {
  constructor(private documentManager: DocumentManager) {}

  async definitions(
    params: DefinitionParams,
    node: LiquidHtmlNode,
    _ancestors: LiquidHtmlNode[],
  ): Promise<DefinitionLink[]> {
    // Only handle VariableLookup nodes with a non-null name
    if (node.type !== NodeTypes.VariableLookup || node.name === null) {
      return [];
    }

    const variableName = node.name;
    const cursorOffset = node.position.start;

    const sourceCode = this.documentManager.get(params.textDocument.uri);
    if (
      !sourceCode ||
      sourceCode.type !== SourceCodeType.LiquidHtml ||
      sourceCode.ast instanceof Error
    ) {
      return [];
    }

    // Collect all assign definitions for this variable name
    const assignDefinitions = visit<SourceCodeType.LiquidHtml, AssignDefinition>(
      sourceCode.ast,
      {
        AssignMarkup(assignNode) {
          if (assignNode.name !== variableName) return;
          return {
            name: assignNode.name,
            nameStart: assignNode.position.start,
            nameEnd: assignNode.position.start + assignNode.name.length,
          };
        },
      },
    );

    if (assignDefinitions.length === 0) {
      return [];
    }

    // Find the last assign that appears before the cursor position.
    // This handles shadowing: later assigns win for later references.
    let bestDefinition: AssignDefinition | undefined;
    for (const def of assignDefinitions) {
      if (def.nameStart < cursorOffset) {
        if (!bestDefinition || def.nameStart > bestDefinition.nameStart) {
          bestDefinition = def;
        }
      }
    }

    if (!bestDefinition) {
      return [];
    }

    const { textDocument } = sourceCode;

    const targetRange = Range.create(
      textDocument.positionAt(bestDefinition.nameStart),
      textDocument.positionAt(bestDefinition.nameEnd),
    );

    const originRange = Range.create(
      textDocument.positionAt(node.position.start),
      textDocument.positionAt(node.position.end),
    );

    return [
      LocationLink.create(
        params.textDocument.uri,
        targetRange,
        targetRange,
        originRange,
      ),
    ];
  }
}
