import { LiquidHtmlNode, NamedTags, NodeTypes } from '@shopify/liquid-html-parser';
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
  /** The offset of the start of the assign markup */
  assignStart: number;
  /** The offset of the end of the assign markup */
  assignEnd: number;
  /** The offset of the start of the name within the assign markup */
  nameStart: number;
  /** The offset of the end of the name within the assign markup */
  nameEnd: number;
}

interface Scope {
  start: number;
  end: number;
}

/**
 * Provides go-to-definition for Liquid variable references.
 *
 * When the cursor is on a `VariableLookup` (e.g. `{{ my_var }}`), this provider
 * finds the `{% assign my_var = ... %}` that defines it.
 *
 * Returns all matching assigns that are visible from the lookup location.
 * With a single result the editor jumps directly; with multiple results the
 * editor shows a peek list.
 *
 * For now, this only handles `assign` tags. Future expansion will add support
 * for `capture`, `for`, `tablerow`, and `@param`.
 */
export class VariableDefinitionProvider implements BaseDefinitionProvider {
  constructor(private documentManager: DocumentManager) {}

  async definitions(
    params: DefinitionParams,
    node: LiquidHtmlNode,
    ancestors: LiquidHtmlNode[],
  ): Promise<DefinitionLink[]> {
    // Only handle VariableLookup nodes with a non-null name
    if (node.type !== NodeTypes.VariableLookup || node.name === null) {
      return [];
    }

    const variableName = node.name;
    const cursorOffset = node.position.start;
    const visibleAssignScope = localAssignScope(variableName, node, ancestors);

    const sourceCode = this.documentManager.get(params.textDocument.uri);
    if (
      !sourceCode ||
      sourceCode.type !== SourceCodeType.LiquidHtml ||
      sourceCode.ast instanceof Error
    ) {
      return [];
    }

    // Collect all assign definitions for this variable name
    const assignDefinitions = visit<SourceCodeType.LiquidHtml, AssignDefinition>(sourceCode.ast, {
      AssignMarkup(assignNode) {
        if (assignNode.name !== variableName) return;
        return {
          assignStart: assignNode.position.start,
          assignEnd: assignNode.position.end,
          nameStart: assignNode.position.start,
          nameEnd: assignNode.position.start + assignNode.name.length,
        };
      },
    });

    if (assignDefinitions.length === 0) {
      return [];
    }

    // Only return assigns that are visible from the lookup location.
    // Using assignEnd avoids treating the current assign as a definition for
    // self-referential lookups like `{% assign x = x | plus: 1 %}`.
    const defsBeforeCursor = assignDefinitions.filter((def) => {
      if (def.assignEnd > cursorOffset) {
        return false;
      }

      if (!visibleAssignScope) {
        return true;
      }

      return def.assignStart >= visibleAssignScope.start && def.assignEnd <= visibleAssignScope.end;
    });

    if (defsBeforeCursor.length === 0) {
      return [];
    }

    const { textDocument } = sourceCode;

    const originRange = Range.create(
      textDocument.positionAt(node.position.start),
      textDocument.positionAt(node.position.end),
    );

    return defsBeforeCursor.map((def) => {
      const targetRange = Range.create(
        textDocument.positionAt(def.nameStart),
        textDocument.positionAt(def.nameEnd),
      );

      return LocationLink.create(params.textDocument.uri, targetRange, targetRange, originRange);
    });
  }
}

function localAssignScope(
  variableName: string,
  node: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[],
): Scope | undefined {
  for (let index = ancestors.length - 1; index >= 0; index--) {
    const ancestor = ancestors[index];

    if (
      ancestor.type === NodeTypes.LiquidTag &&
      (ancestor.name === NamedTags.for || ancestor.name === NamedTags.tablerow) &&
      typeof ancestor.markup !== 'string' &&
      ancestor.markup.variableName === variableName &&
      ancestor.blockStartPosition &&
      ancestor.blockEndPosition &&
      node.position.start >= ancestor.blockStartPosition.start &&
      node.position.start <= ancestor.blockEndPosition.end
    ) {
      return {
        start: ancestor.blockStartPosition.start,
        end: ancestor.blockEndPosition.end,
      };
    }
  }
}
