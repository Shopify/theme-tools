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
  ThemeColor,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  window,
} from 'vscode';
import { BaseLanguageClient } from 'vscode-languageclient';

export function createReferencesTreeView(
  viewId: string,
  context: ExtensionContext,
  client: BaseLanguageClient,
  mode: 'references' | 'dependencies' = 'references',
): TreeView<TreeItem> {
  const provider = new ReferencesProvider(context, client!, mode);
  const treeView = window.createTreeView(viewId, {
    treeDataProvider: provider,
  });
  treeView.onDidChangeVisibility((event) => {
    if (event.visible) {
      provider.visible = true;
    }
  });
  provider.visible = treeView.visible;
  return treeView;
}

export class ReferencesProvider implements TreeDataProvider<TreeItem> {
  static NoReferencesTreeItem = new TreeItem('No references found', TreeItemCollapsibleState.None);
  static NoDependenciesTreeItem = new TreeItem(
    'No dependencies found',
    TreeItemCollapsibleState.None,
  );
  static SelectFileTreeItem = new TreeItem(
    'Select a file to view references',
    TreeItemCollapsibleState.None,
  );

  static LoadingTreeItem = (item: string, mode: string) =>
    new TreeItem(`Loading ${mode} for ${item}...`, TreeItemCollapsibleState.None);

  private _onDidChangeTreeData: EventEmitter<TreeItem | undefined> = new EventEmitter<
    TreeItem | undefined
  >();
  readonly onDidChangeTreeData: Event<TreeItem | undefined> = this._onDidChangeTreeData.event;
  _references: ReferenceItem[] | [TreeItem] = [ReferencesProvider.SelectFileTreeItem];

  get references(): ReferenceItem[] | [TreeItem] {
    return this._references;
  }

  set references(value: ReferenceItem[] | [TreeItem]) {
    this._references = value;
    this._onDidChangeTreeData.fire(undefined);
  }

  constructor(
    private context: ExtensionContext,
    private readonly client: BaseLanguageClient,
    private mode: 'references' | 'dependencies' = 'references',
  ) {
    window.onDidChangeActiveTextEditor(() => this.onActiveEditorChanged());
    client.onNotification(ThemeGraphDidUpdateNotification.type, () => this.refresh());
  }

  getTreeItem(element: ReferenceItem): TreeItem {
    return element;
  }

  async getChildren(element?: ReferenceItem): Promise<ReferenceItem[] | [TreeItem]> {
    if (!element) {
      return this.references ?? [];
    }

    // Don't do anything fancy right now
    return [];
  }

  public async refresh() {
    const uri = window.activeTextEditor?.document.uri.toString();
    if (!uri) {
      this.references = [ReferencesProvider.SelectFileTreeItem];
      return;
    }

    this.references = [ReferencesProvider.LoadingTreeItem(path.basename(uri), this.mode)];

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
        // Sort by type first, then by URI
        if (a.type !== b.type) {
          return refTypes.indexOf(a.type) - refTypes.indexOf(b.type);
        }
        return a[destination].uri.localeCompare(b[destination].uri);
      })
      .map((ref) => new ReferenceItem(rootUri, ref, undefined, destination));

    if (this.references.length === 0) {
      this.references =
        this.mode === 'references'
          ? [ReferencesProvider.NoReferencesTreeItem]
          : [ReferencesProvider.NoDependenciesTreeItem];
    }
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
      this.references = [ReferencesProvider.SelectFileTreeItem];
    }
  }

  private _visible = false;
  get visible(): boolean {
    return this._visible;
  }
  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.refresh();
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
    this.iconPath = ReferenceItem.icon(reference, dest);
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

  static icon(ref: AugmentedReference, dest: AugmentedLocation): ThemeIcon | undefined {
    if (dest.exists === false) {
      return new ThemeIcon('warning', new ThemeColor('editorError.foreground'));
    }

    switch (ref.type) {
      case 'indirect':
        return new ThemeIcon('symbol-misc', new ThemeColor('button.secondaryForeground'));
      case 'preset':
        return new ThemeIcon('symbol-method', new ThemeColor(''));
      default:
        return undefined;
    }
  }
}

const refTypes = ['direct', 'preset', 'indirect'] as const;
