import { Location, ReferenceParams } from "vscode-languageserver-protocol";
import { DocumentManager } from "../../documents";
import { BaseReferencesProvider } from "../BaseReferencesProvider";
import { GetLiquidFiles } from "../ReferencesProvider";
import { LiquidHtmlNode, LiquidTag, NamedTags } from "@shopify/liquid-html-parser";
import { SourceCodeType, visit } from "@shopify/theme-check-common";
import { Range } from "vscode-json-languageservice";

export class BlockReferencesProvider implements BaseReferencesProvider {
  constructor(private documentManager: DocumentManager, private getLiquidFiles: GetLiquidFiles) {}

  async references(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: ReferenceParams): Promise<Location[] | undefined> {
    const sources = await this.getLiquidFiles(params.textDocument.uri);
    const document = this.documentManager.get(params.textDocument.uri)

    if (!document || document.type !== SourceCodeType.LiquidHtml || document.ast instanceof Error) {
      return;
    }

    const parentNode = ancestors.at(-1);
    const grandparentNode = ancestors.at(-2);
    if (!parentNode || !grandparentNode) return;
    if (
      currentNode.type !== 'String' ||
      parentNode.type !== 'NamedArgument' ||
      grandparentNode.type !== 'ContentForMarkup'
    ) return;

    const referenceLocations = [] as Location[]

    for (const source of sources) {
      if (source.ast instanceof Error) continue;

      referenceLocations.push(...visit<SourceCodeType.LiquidHtml, Location>(source.ast, {
        LiquidTag(node: LiquidTag) {
          if (node.name === NamedTags.content_for) {
            if (typeof node.markup === 'string') return;

            const typeArg = node.markup.args.find((arg) => arg.name === 'type');

            if (!typeArg || typeArg.value.type !== 'String') return;

            if (typeArg.value.value === currentNode.value) {
              return {
                uri: source.uri,
                range: Range.create(
                  source.textDocument.positionAt(typeArg.value.position.start + 1),
                  source.textDocument.positionAt(typeArg.value.position.end - 1),
                ),
              };
            }
          }
        }
      }));
    }

    // TODO: check if the block appears in any schema
    // Need building blocks to know where in the block it appears (i.e. position)

    return referenceLocations;
  }
}
