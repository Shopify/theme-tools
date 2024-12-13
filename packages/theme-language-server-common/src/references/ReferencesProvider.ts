import { Location, ReferenceParams } from "vscode-languageserver-protocol";
import { AugmentedLiquidSourceCode, DocumentManager } from "../documents";
import { BaseReferencesProvider } from "./BaseReferencesProvider";
import { findCurrentNode, SourceCodeType } from "@shopify/theme-check-common";
import { BlockReferencesProvider } from "./providers/BlockReferencesProvider";
import { SnippetReferencesProvider } from "./providers/SnippetReferencesProvider";

export type GetLiquidFiles = (rootUri: string) => Promise<AugmentedLiquidSourceCode[]>;

export class ReferencesProvider {
  private providers: BaseReferencesProvider[];

  constructor(
    private documentManager: DocumentManager,
    private getLiquidFiles: GetLiquidFiles,
  ) {
    this.providers = [
      new BlockReferencesProvider(this.documentManager, this.getLiquidFiles),
      new SnippetReferencesProvider(this.documentManager, this.getLiquidFiles),
    ];
  }

  async references(params: ReferenceParams): Promise<Location[] | undefined> {
    try {
      const document = this.documentManager.get(params.textDocument.uri)
  
      if (!document || document.type !== SourceCodeType.LiquidHtml || document.ast instanceof Error) {
        return;
      }
      
      const [currentNode, ancestors] = findCurrentNode(document.ast, document.textDocument.offsetAt(params.position));

      const promises = this.providers.map((provider) => provider.references(currentNode, ancestors, params));

      const locations = [];

      for(const promise of promises) {
        const result = await promise;
        if (result) {
          locations.push(...result);
        }
      }

      return locations;
    } catch (error) {
      console.error(error);
      return;
    }
  }
}