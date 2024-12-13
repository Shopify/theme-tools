import { Location, ReferenceParams } from "vscode-languageserver-protocol";
import { DocumentManager } from "../../documents";
import { BaseReferencesProvider } from "../BaseReferencesProvider";
import { GetLiquidFiles } from "../ReferencesProvider";
import { LiquidHtmlNode, LiquidTag, NamedTags, NodeTypes } from "@shopify/liquid-html-parser";
import { SourceCodeType, visit } from "@shopify/theme-check-common";
import { Range } from "vscode-json-languageservice";

export class SnippetReferencesProvider implements BaseReferencesProvider {
  constructor(private documentManager: DocumentManager, private getLiquidFiles: GetLiquidFiles) {}

  async references(currentNode: LiquidHtmlNode, ancestors: LiquidHtmlNode[], params: ReferenceParams): Promise<Location[] | undefined> {
    const sources = await this.getLiquidFiles(params.textDocument.uri);
    const document = this.documentManager.get(params.textDocument.uri)

    if (!document || document.type !== SourceCodeType.LiquidHtml || document.ast instanceof Error) {
      return;
    }

    const parentNode = ancestors.at(-1);
    if (!parentNode || parentNode.type !== 'RenderMarkup' || currentNode.type !== 'String') {
      return;
    }

    const referenceLocations = [] as Location[];

    for (const source of sources) {
      if (source.ast instanceof Error) continue;

      referenceLocations.push(...visit<SourceCodeType.LiquidHtml, Location>(source.ast, {
        LiquidTag(node: LiquidTag) {
          if ((node.name === NamedTags.render || node.name === NamedTags.include) && typeof node.markup !== 'string') {
            const snippet = node.markup.snippet;
            if (snippet.type === NodeTypes.String && snippet.value === currentNode.value) {
              return {
                uri: source.uri,
                range: Range.create(
                  source.textDocument.positionAt(snippet.position.start + 1),
                  source.textDocument.positionAt(snippet.position.end - 1),
                ),
              };
            }
          }
        },
      }))
    }

    return referenceLocations;
  }
}
