import { path } from '@shopify/theme-check-common';
import {
  AugmentedLocation,
  AugmentedReference,
  ThemeGraphDependenciesRequest,
  ThemeGraphDidUpdateNotification,
  ThemeGraphReferenceRequest,
  ThemeGraphRootRequest,
} from '@shopify/theme-language-server-common';
import {
  Event,
  EventEmitter,
  ExtensionContext,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
} from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';

export class ReferencesProvider implements TreeDataProvider<ReferenceItem> {
  private _onDidChangeTreeData: EventEmitter<ReferenceItem | undefined> = new EventEmitter<
    ReferenceItem | undefined
  >();
  readonly onDidChangeTreeData: Event<ReferenceItem | undefined> = this._onDidChangeTreeData.event;
  references: ReferenceItem[] | null = null;

  constructor(
    private context: ExtensionContext,
    private readonly client: BaseLanguageClient,
    private mode: 'references' | 'dependencies' = 'references',
  ) {
    window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
    client.onNotification(ThemeGraphDidUpdateNotification.type, () => this.refresh());
    this.refresh();
  }

  getTreeItem(element: ReferenceItem): TreeItem {
    return element;
  }

  async getChildren(element?: ReferenceItem): Promise<ReferenceItem[]> {
    if (this.references === null) {
      await this.refresh();
    }

    if (!element) {
      return this.references ?? [];
    }

    return [];
  }

  private async refresh() {
    const uri = window.activeTextEditor?.document.uri.toString();
    const command =
      this.mode === 'references'
        ? ThemeGraphReferenceRequest.method
        : ThemeGraphDependenciesRequest.method;
    const destination = this.mode === 'references' ? 'source' : 'target';
    const [rootUri, references] = await Promise.all([
      this.client.sendRequest(ThemeGraphRootRequest.type, { uri }),
      this.client.sendRequest<AugmentedReference[]>(command, { uri }),
    ]);
    this.references = references
      .sort((a, b) => {
        if (a.indirect !== b.indirect) return a.indirect ? 1 : -1;
        return a[destination].uri.localeCompare(b[destination].uri);
      })
      .map((ref) => new ReferenceItem(rootUri, ref, undefined, destination));
    this._onDidChangeTreeData.fire(undefined);
  }

  private onActiveEditorChanged(): void {
    if (window.activeTextEditor) {
      const enabled = ['liquid', 'javascript', 'json', 'jsonc', 'css'].includes(
        window.activeTextEditor.document.languageId,
      );
      if (enabled) {
        this.refresh();
      }
    } else {
      this.references = null;
    }
  }
}

class ReferenceItem extends TreeItem {
  parent?: ReferenceItem;
  source: AugmentedReference['source'];
  target: AugmentedReference['target'];
  indirect?: boolean;

  constructor(
    rootUri: string,
    reference: AugmentedReference,
    parent?: ReferenceItem,
    destinationKey: 'source' | 'target' = 'source',
  ) {
    const dest = reference[destinationKey];
    super(ReferenceItem.label(rootUri, dest), TreeItemCollapsibleState.None);
    this.source = reference.source;
    this.target = reference.target;
    this.indirect = reference.indirect;
    this.parent = parent;
    this.description = reference.source.excerpt; // always interested in the source excerpt
    this.resourceUri = Uri.parse(dest.uri);
    this.iconPath = reference.indirect ? new ThemeIcon('combine') : undefined;
    this.command = {
      command: 'shopifyLiquid.openLocation',
      title: 'View reference',
      arguments: [dest],
    };
    this.contextValue = 'referenceItem';
  }

  static label(rootUri: string, dest: AugmentedLocation): string {
    const sourcePath = path.relative(dest.uri, rootUri);
    return sourcePath;
  }
}
