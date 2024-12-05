import {
  isBlockSchema,
  isError,
  isSectionSchema,
  JSONNode,
  nodeAtPath,
  parseJSON,
  path,
  Preset,
  Section,
  Setting,
  ThemeBlock,
} from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import {
  ApplyWorkspaceEditRequest,
  Range,
  RenameFilesParams,
  TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import { DocumentManager, isJsonSourceCode, isLiquidSourceCode } from '../../documents';
import { blockName, isBlock, isSection, isSectionGroup, isTemplate } from '../../utils/uri';
import { BaseRenameHandler } from '../BaseRenameHandler';

type Element<T> = T extends Array<infer U> ? U : never;
type DocumentChange = Element<NonNullable<WorkspaceEdit['documentChanges']>>;

export namespace Template {
  export interface Template {
    layout?: string | false;
    wrapper?: string;
    sections: Record<string, Template.Section>;
    order: string[];
  }

  export interface Section {
    type: string;
    settings?: Setting.Values;
    disabled?: boolean;
    blocks?: Record<string, Template.Block>;
    block_order?: string[];
  }

  export interface Block {
    type: string;
    settings?: Setting.Values;
    disabled?: boolean;
    blocks?: Record<string, Template.Block>;
    block_order?: string[];
    static?: boolean;
  }
}

/**
 * The BlockRenameHandler will handle block renames.
 *
 * Whenever a block gets renamed, a lot of things need to happen:
 *   1. references to it in all template files must be changed
 *   2. references to it in section groups must be changed
 *   3. references to it in files with a {% schema %} must be changed
 *   4. references in content_for "block", type: "oldName" must be changed
 */
export class BlockRenameHandler implements BaseRenameHandler {
  constructor(
    private documentManager: DocumentManager,
    private connection: Connection,
    private capabilities: ClientCapabilities,
    private findThemeRootURI: (uri: string) => Promise<string>,
  ) {}

  async onDidRenameFiles(params: RenameFilesParams): Promise<void> {
    if (!this.capabilities.hasApplyEditSupport) return;

    const relevantRenames = params.files.filter(
      (file) => isBlock(file.oldUri) && isBlock(file.newUri),
    );

    // Only preload if you have something to do
    if (relevantRenames.length === 0) return;
    const rootUri = await this.findThemeRootURI(path.dirname(params.files[0].oldUri));
    await this.documentManager.preload(rootUri);
    const theme = this.documentManager.theme(rootUri, true);
    const sectionsAndBlocks = theme
      .filter(isLiquidSourceCode)
      .filter((file) => isBlock(file.uri) || isSection(file.uri));
    const templates = theme.filter(isJsonSourceCode).filter((file) => isTemplate(file.uri));
    const sectionGroups = theme.filter(isJsonSourceCode).filter((file) => isSectionGroup(file.uri));

    const promises = relevantRenames.map(async (file) => {
      const oldBlockName = blockName(file.oldUri);
      const newBlockName = blockName(file.newUri);
      const editLabel = `Rename block '${oldBlockName}' to '${newBlockName}'`;
      const annotationId = 'renameBlock';
      const workspaceEdit: WorkspaceEdit = {
        documentChanges: [],
        changeAnnotations: {
          [annotationId]: {
            label: editLabel,
            needsConfirmation: false,
          },
        },
      };

      const sectionsWithLocalBlocks = new Set();

      const sectionAndBlocksChanges: (DocumentChange | null)[] = await Promise.all(
        sectionsAndBlocks.map(async (sourceCode) => {
          if (sourceCode.ast instanceof Error) return null;
          const textDocument = sourceCode.textDocument;
          const schema = await sourceCode.getSchema();
          if (!isBlockSchema(schema) && !isSectionSchema(schema)) return null;
          if (isError(schema.validSchema) || isError(schema.ast)) return null;
          const { validSchema, ast, offset } = schema;

          const edits: TextEdit[] = [];
          if (validSchema.blocks) {
            for (let i = 0; i < validSchema.blocks.length; i++) {
              const blockDef = validSchema.blocks[i];
              if (isLocalBlock(blockDef)) {
                // If the section has a local blocks, we shouldn't rename
                // anything in this file.
                if (isSectionSchema(schema)) {
                  sectionsWithLocalBlocks.add(schema.name);
                }
                return null;
              }

              if (blockDef.type !== oldBlockName) continue;
              const node = nodeAtPath(ast, ['blocks', i, 'type']);
              edits.push({
                newText: newBlockName,
                range: Range.create(
                  textDocument.positionAt(offset + node!.loc!.start.offset + 1),
                  textDocument.positionAt(offset + node!.loc!.end.offset - 1),
                ),
              });
            }
          }

          const presetEdits = (
            presetBlock: Preset.Preset | Preset.Block | undefined,
            path: (string | number)[],
          ): TextEdit[] => {
            if (!presetBlock || !('blocks' in presetBlock)) return [];
            if (Array.isArray(presetBlock.blocks)) {
              return presetBlock.blocks.flatMap((block, index) => {
                const edits = presetEdits(block, [...path, 'blocks', index]);
                if (block.type === oldBlockName) {
                  const node = nodeAtPath(ast, [...path, 'blocks', index, 'type']);
                  edits.push({
                    newText: newBlockName,
                    range: Range.create(
                      textDocument.positionAt(offset + node!.loc!.start.offset + 1),
                      textDocument.positionAt(offset + node!.loc!.end.offset - 1),
                    ),
                  });
                }
                return edits;
              });
            } else if (typeof presetBlock.blocks === 'object') {
              return Object.entries(presetBlock.blocks).flatMap(([key, block]) => {
                const edits = presetEdits(block, [...path, 'blocks', key]);
                if (block.type === oldBlockName) {
                  const node = nodeAtPath(ast, [...path, 'blocks', key, 'type']);
                  edits.push({
                    newText: newBlockName,
                    range: Range.create(
                      textDocument.positionAt(offset + node!.loc!.start.offset + 1),
                      textDocument.positionAt(offset + node!.loc!.end.offset - 1),
                    ),
                  });
                }
                return edits;
              });
            } else {
              return [];
            }
          };

          if (validSchema.presets) {
            edits.push(
              ...validSchema.presets.flatMap((preset, i) => presetEdits(preset, ['presets', i])),
            );
          }

          if (edits.length === 0) return null;
          return {
            textDocument: {
              uri: textDocument.uri,
              version: sourceCode.version ?? null /* null means file from disk in this API */,
            },
            annotationId,
            edits,
          };
        }),
      );

      const templateEdits: (DocumentChange | null)[] = await Promise.all(
        templates.map(async (sourceCode) => {
          // assuming that the JSON is valid...
          const { textDocument, ast, source } = sourceCode;
          const parsed = parseJSON(source);
          if (!parsed || isError(parsed) || isError(ast)) return null;
          function blocksEdits(
            blocks: Record<string, Template.Block> | undefined,
            path: (string | number)[],
          ): TextEdit[] {
            if (!blocks) return [];
            return Object.entries(blocks).flatMap(([key, block]) => {
              const _edits = blocksEdits(block.blocks, [...path, key, 'blocks']);
              if (block.type === oldBlockName) {
                const node = nodeAtPath(ast as JSONNode, [...path, key, 'type'])!;
                _edits.push({
                  newText: newBlockName,
                  range: Range.create(
                    textDocument.positionAt(node.loc!.start.offset + 1),
                    textDocument.positionAt(node.loc!.end.offset - 1),
                  ),
                });
              }
              return _edits;
            });
          }

          const edits: TextEdit[] = !isValidTemplate(parsed)
            ? []
            : Object.entries(parsed.sections).flatMap(([key, section]) => {
                if (
                  'blocks' in section &&
                  !!section.blocks &&
                  !sectionsWithLocalBlocks.has(section.type)
                ) {
                  return blocksEdits(section.blocks, ['sections', key, 'blocks']);
                } else {
                  return [];
                }
              });

          if (edits.length === 0) return null;

          return {
            textDocument: {
              uri: sourceCode.uri,
              version: sourceCode.version ?? null /* null means file from disk in this API */,
            },
            annotationId,
            edits,
          };
        }),
      );

      for (const docChange of [...sectionAndBlocksChanges, ...templateEdits]) {
        if (docChange !== null) {
          workspaceEdit.documentChanges!.push(docChange);
        }
      }

      if (workspaceEdit.documentChanges!.length === 0) {
        console.error('Nothing to do!');
        return;
      }

      return this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
        label: editLabel,
        edit: workspaceEdit,
      });
    });

    await Promise.all(promises);
  }
}

function isLocalBlock(blockDef: ThemeBlock.Block | Section.Block): blockDef is Section.LocalBlock {
  return 'name' in blockDef && typeof blockDef.name === 'string';
}

// this is very very optimistic...
function isValidTemplate(parsed: unknown): parsed is Template.Template {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'sections' in parsed &&
    'order' in parsed &&
    Array.isArray((parsed as Template.Template).order)
  );
}
