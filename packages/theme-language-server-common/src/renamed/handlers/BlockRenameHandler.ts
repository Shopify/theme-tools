import { NodeTypes } from '@shopify/liquid-html-parser';
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
  SourceCodeType,
  ThemeBlock,
  visit,
} from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import {
  ApplyWorkspaceEditRequest,
  Range,
  RenameFilesParams,
  TextDocumentEdit,
  AnnotatedTextEdit as TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { ClientCapabilities } from '../../ClientCapabilities';
import {
  AugmentedJsonSourceCode,
  AugmentedLiquidSourceCode,
  AugmentedSourceCode,
  DocumentManager,
  isJsonSourceCode,
  isLiquidSourceCode,
} from '../../documents';
import { blockName, isBlock, isSection, isSectionGroup, isTemplate } from '../../utils/uri';
import { BaseRenameHandler } from '../BaseRenameHandler';

type DocumentChange = TextDocumentEdit;

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

  export interface SectionGroup {
    type: string;
    name: string;
    sections: Record<string, Template.Section>;
    order: string[];
  }
}

const annotationId = 'renameBlock';

/**
 * The BlockRenameHandler will handle block renames.
 *
 * Whenever a block gets renamed, a lot of things need to happen:
 *   1. References in files with a {% schema %} must be changed
 *   2. References in template files must be changed
 *   3. References in section groups must be changed
 *   4. References in {% content_for "block", type: "oldName" %} must be changed
 *
 * Things we're not doing:
 *   5. If isPublic(oldName) && isPrivate(newName) && "schema.blocks" accepts "@theme",
 *      Then the block should be added to the "blocks" array
 *
 *    Reasoning: this is more noisy than useful. a now-private block
 *      could be used by a preset, template or section group. Doing a
 *      toil-free rename would require visiting all preset, templates and
 *      section groups to see if a parent that uses the new block name
 *      was supporting "@theme" blocks. It's a lot. It's O(S*(S+T+SG)) where
 *      S is the number of sections, T is the number of templates and SG is the
 *      number of section groups. It's not worth it.
 *
 *      This stuff is complicated enough as it is 😅.
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
    const liquidFiles = theme.filter(isLiquidSourceCode);
    const sectionsAndBlocks = liquidFiles.filter(
      (file) => isBlock(file.uri) || isSection(file.uri),
    );
    const templates = theme.filter(isJsonSourceCode).filter((file) => isTemplate(file.uri));
    const sectionGroups = theme.filter(isJsonSourceCode).filter((file) => isSectionGroup(file.uri));

    const promises = relevantRenames.map(async (file) => {
      const oldBlockName = blockName(file.oldUri);
      const newBlockName = blockName(file.newUri);
      const editLabel = `Rename block '${oldBlockName}' to '${newBlockName}'`;
      const workspaceEdit: WorkspaceEdit = {
        documentChanges: [],
        changeAnnotations: {
          [annotationId]: {
            label: editLabel,
            needsConfirmation: false,
          },
        },
      };

      const documentChanges = (
        sourceCode: AugmentedSourceCode,
        edits: TextEdit[],
      ): DocumentChange => ({
        textDocument: {
          uri: sourceCode.uri,
          version: sourceCode.version ?? null /* null means file from disk in this API */,
        },
        edits,
      });

      // We need to keep track of sections that have local blocks, because we
      // shouldn't rename those. Only uses of "@theme" or specifically named blocks
      // should be renamed when the blocks/*.liquid file is renamed.
      const sectionsWithLocalBlocks = new Set();

      const sectionAndBlocksChanges: (DocumentChange | null)[] = await Promise.all(
        sectionsAndBlocks.map(
          this.getSchemaChanges(
            sectionsWithLocalBlocks,
            oldBlockName,
            newBlockName,
            documentChanges,
          ),
        ),
      );

      // All the templates/*.json files need to be updated with the new block name
      // when the old block name wasn't a local block.
      const [templateChanges, sectionGroupChanges, contentForChanges] = await Promise.all([
        Promise.all(
          templates.map(
            this.getTemplateChanges(
              oldBlockName,
              newBlockName,
              sectionsWithLocalBlocks,
              documentChanges,
            ),
          ),
        ),
        Promise.all(
          sectionGroups.map(
            this.getSectionGroupChanges(
              oldBlockName,
              newBlockName,
              sectionsWithLocalBlocks,
              documentChanges,
            ),
          ),
        ),
        Promise.all(
          liquidFiles.map(this.getContentForChanges(oldBlockName, newBlockName, documentChanges)),
        ),
      ]);

      for (const docChange of [
        ...sectionAndBlocksChanges,
        ...templateChanges,
        ...sectionGroupChanges,
      ]) {
        if (docChange !== null) {
          workspaceEdit.documentChanges!.push(docChange);
        }
      }

      // Because contentForChanges could make a change to an existing document, we need
      // to group the edits together by document. Or else we might have index
      // drifting issues.
      for (const docChange of contentForChanges) {
        if (docChange !== null) {
          const existingDocChange = (workspaceEdit.documentChanges as DocumentChange[]).find(
            (dc) => dc.textDocument.uri === docChange?.textDocument.uri,
          );
          if (existingDocChange) {
            existingDocChange.edits.push(...docChange.edits);
          } else {
            workspaceEdit.documentChanges!.push(docChange);
          }
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

  private getSchemaChanges(
    sectionsWithLocalBlocks: Set<unknown>,
    oldBlockName: string,
    newBlockName: string,
    documentChanges: (sourceCode: AugmentedSourceCode, edits: TextEdit[]) => DocumentChange,
  ) {
    return async (sourceCode: AugmentedLiquidSourceCode) => {
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
            annotationId,
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
                annotationId,
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
                annotationId,
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

      return documentChanges(sourceCode, edits);
    };
  }

  private getTemplateChanges(
    oldBlockName: string,
    newBlockName: string,
    sectionsWithLocalBlocks: Set<unknown>,
    documentChanges: (sourceCode: AugmentedSourceCode, edits: TextEdit[]) => DocumentChange,
  ) {
    return async (sourceCode: AugmentedJsonSourceCode) => {
      // assuming that the JSON is valid...
      const { textDocument, ast, source } = sourceCode;
      const parsed = parseJSON(source);
      if (!parsed || isError(parsed) || isError(ast)) return null;
      const getBlocksEdits = getBlocksEditsFactory(oldBlockName, newBlockName, textDocument, ast);
      const edits: TextEdit[] = !isValidTemplate(parsed)
        ? []
        : Object.entries(parsed.sections).flatMap(([key, section]) => {
            if (
              'blocks' in section &&
              !!section.blocks &&
              !sectionsWithLocalBlocks.has(section.type) // don't rename local blocks
            ) {
              return getBlocksEdits(section.blocks, ['sections', key, 'blocks']);
            } else {
              return [];
            }
          });

      if (edits.length === 0) return null;

      return documentChanges(sourceCode, edits);
    };
  }

  private getSectionGroupChanges(
    oldBlockName: string,
    newBlockName: string,
    sectionsWithLocalBlocks: Set<unknown>,
    documentChanges: (sourceCode: AugmentedSourceCode, edits: TextEdit[]) => DocumentChange,
  ) {
    return async (sourceCode: AugmentedJsonSourceCode) => {
      const { textDocument, ast, source } = sourceCode;
      const parsed = parseJSON(source);
      if (!parsed || isError(parsed) || isError(ast)) return null;
      const getBlocksEdits = getBlocksEditsFactory(oldBlockName, newBlockName, textDocument, ast);
      const edits: TextEdit[] = !isValidSectionGroup(parsed)
        ? []
        : Object.entries(parsed.sections).flatMap(([key, section]) => {
            if (
              'blocks' in section &&
              !!section.blocks &&
              !sectionsWithLocalBlocks.has(section.type) // don't rename local blocks
            ) {
              return getBlocksEdits(section.blocks, ['sections', key, 'blocks']);
            } else {
              return [];
            }
          });

      if (edits.length === 0) return null;

      return documentChanges(sourceCode, edits);
    };
  }

  private getContentForChanges(
    oldBlockName: string,
    newBlockName: string,
    documentChanges: (sourceCode: AugmentedSourceCode, edits: TextEdit[]) => DocumentChange,
  ) {
    return async (sourceCode: AugmentedLiquidSourceCode) => {
      const { textDocument, ast } = sourceCode;
      if (isError(ast)) return null;

      const edits = visit<SourceCodeType.LiquidHtml, TextEdit>(ast, {
        LiquidTag(node) {
          if (node.name !== 'content_for') return;
          if (typeof node.markup === 'string') return;
          if (node.markup.contentForType.value !== 'block') return;
          const typeNode = node.markup.args.find((arg) => arg.name === 'type');
          if (
            !typeNode ||
            typeNode.value.type !== NodeTypes.String ||
            typeNode.value.value !== oldBlockName
          ) {
            return;
          }

          return {
            annotationId,
            newText: newBlockName,
            range: Range.create(
              textDocument.positionAt(typeNode.value.position.start + 1),
              textDocument.positionAt(typeNode.value.position.end - 1),
            ),
          };
        },
      });

      if (edits.length === 0) return null;

      return documentChanges(sourceCode, edits);
    };
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

function isValidSectionGroup(parsed: unknown): parsed is Template.SectionGroup {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    'sections' in parsed &&
    'order' in parsed &&
    Array.isArray((parsed as Template.SectionGroup).order)
  );
}

function getBlocksEditsFactory(
  oldBlockName: string,
  newBlockName: string,
  textDocument: TextDocument,
  ast: JSONNode,
) {
  return function getBlocksEdits(
    blocks: Record<string, Template.Block> | undefined,
    path: (string | number)[],
  ): TextEdit[] {
    if (!blocks) return [];
    return Object.entries(blocks).flatMap(([key, block]) => {
      const edits = getBlocksEdits(block.blocks, [...path, key, 'blocks']);
      if (block.type === oldBlockName) {
        const node = nodeAtPath(ast, [...path, key, 'type'])!;
        edits.push({
          annotationId,
          newText: newBlockName,
          range: Range.create(
            textDocument.positionAt(node.loc!.start.offset + 1),
            textDocument.positionAt(node.loc!.end.offset - 1),
          ),
        });
      }
      return edits;
    });
  };
}
