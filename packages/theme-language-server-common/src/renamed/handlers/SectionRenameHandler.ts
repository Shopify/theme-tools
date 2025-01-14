import { LiquidString } from '@shopify/liquid-html-parser';
import {
  isError,
  LiteralNode,
  nodeAtPath,
  parseJSON,
  path,
  SourceCodeType,
  visit,
} from '@shopify/theme-check-common';
import { Connection } from 'vscode-languageserver';
import {
  AnnotatedTextEdit,
  ApplyWorkspaceEditRequest,
  Range,
  RenameFilesParams,
  TextDocumentEdit,
  AnnotatedTextEdit as TextEdit,
  WorkspaceEdit,
} from 'vscode-languageserver-protocol';
import { ClientCapabilities } from '../../ClientCapabilities';
import {
  AugmentedJsonSourceCode,
  AugmentedLiquidSourceCode,
  AugmentedSourceCode,
  DocumentManager,
  isJsonSourceCode,
  isLiquidSourceCode,
} from '../../documents';
import { isSection, isSectionGroup, isTemplate, sectionName } from '../../utils/uri';
import { BaseRenameHandler } from '../BaseRenameHandler';
import { isValidSectionGroup, isValidTemplate } from './utils';

type DocumentChange = TextDocumentEdit;

const annotationId = 'renameSection';

/**
 * The SectionRenameHandler will handle section renames
 *
 * Whenever a section gets renamed, a lot of things need to happen:
 *   2. References in template files must be changed
 *   3. References in section groups must be changed
 *   4. References like {% section "oldName" %} must be changed
 */
export class SectionRenameHandler implements BaseRenameHandler {
  constructor(
    private documentManager: DocumentManager,
    private connection: Connection,
    private capabilities: ClientCapabilities,
    private findThemeRootURI: (uri: string) => Promise<string>,
  ) {}

  async onDidRenameFiles(params: RenameFilesParams): Promise<void> {
    if (!this.capabilities.hasApplyEditSupport) return;

    const relevantRenames = params.files.filter(
      (file) => isSection(file.oldUri) && isSection(file.newUri),
    );

    // Only preload if you have something to do (folder renames not supported yet).
    if (relevantRenames.length !== 1) return;
    const rename = relevantRenames[0];
    const rootUri = await this.findThemeRootURI(path.dirname(params.files[0].oldUri));
    await this.documentManager.preload(rootUri);
    const theme = this.documentManager.theme(rootUri, true);
    const liquidFiles = theme.filter(isLiquidSourceCode);
    const templates = theme.filter(isJsonSourceCode).filter((file) => isTemplate(file.uri));
    const sectionGroups = theme.filter(isJsonSourceCode).filter((file) => isSectionGroup(file.uri));
    const oldSectionName = sectionName(rename.oldUri);
    const newSectionName = sectionName(rename.newUri);
    const editLabel = `Rename section '${oldSectionName}' to '${newSectionName}'`;
    const workspaceEdit: WorkspaceEdit = {
      documentChanges: [],
      changeAnnotations: {
        [annotationId]: {
          label: editLabel,
          needsConfirmation: false,
        },
      },
    };

    // All the templates/*.json files need to be updated with the new block name
    // when the old block name wasn't a local block.
    const [templateChanges, sectionGroupChanges, sectionTagChanges] = await Promise.all([
      Promise.all(templates.map(this.getTemplateChanges(oldSectionName, newSectionName))),
      Promise.all(sectionGroups.map(this.getSectionGroupChanges(oldSectionName, newSectionName))),
      Promise.all(liquidFiles.map(this.getSectionTagChanges(oldSectionName, newSectionName))),
    ]);

    for (const docChange of [...templateChanges, ...sectionGroupChanges]) {
      if (docChange !== null) {
        workspaceEdit.documentChanges!.push(docChange);
      }
    }

    // Because section tag changes could make a change to an existing document,
    // we need to group the edits together by document. Or else we might have
    // index drifting issues.
    for (const docChange of sectionTagChanges) {
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

    await this.connection.sendRequest(ApplyWorkspaceEditRequest.type, {
      label: editLabel,
      edit: workspaceEdit,
    });
  }

  private getTemplateChanges(oldSectionName: string, newSectionName: string) {
    return async (sourceCode: AugmentedJsonSourceCode) => {
      // assuming that the JSON is valid...
      const { textDocument, ast, source } = sourceCode;
      const parsed = parseJSON(source);
      if (!parsed || isError(parsed) || isError(ast)) return null;
      const edits: AnnotatedTextEdit[] = !isValidTemplate(parsed)
        ? []
        : Object.entries(parsed.sections)
            .filter(([_key, section]) => section.type === oldSectionName)
            .map(([key]) => {
              const node = nodeAtPath(ast, ['sections', key, 'type']) as LiteralNode;
              return {
                annotationId,
                newText: newSectionName,
                range: Range.create(
                  textDocument.positionAt(node.loc.start.offset + 1),
                  textDocument.positionAt(node.loc.end.offset - 1),
                ),
              } as AnnotatedTextEdit;
            });

      if (edits.length === 0) return null;

      return documentChanges(sourceCode, edits);
    };
  }

  // Awfully similar except for the isValidSectionGroup check and the types of the objects.
  // Feels like a coincidence that the types are so similar. I'm not sure this should be DRY'd up.
  private getSectionGroupChanges(oldSectionName: string, newSectionName: string) {
    return async (sourceCode: AugmentedJsonSourceCode) => {
      const { textDocument, ast, source } = sourceCode;
      const parsed = parseJSON(source);
      if (!parsed || isError(parsed) || isError(ast)) return null;
      const edits: TextEdit[] = !isValidSectionGroup(parsed)
        ? []
        : Object.entries(parsed.sections)
            .filter(([_key, section]) => section.type === oldSectionName)
            .map(([key]) => {
              const node = nodeAtPath(ast, ['sections', key, 'type']) as LiteralNode;
              return {
                annotationId,
                newText: newSectionName,
                range: Range.create(
                  textDocument.positionAt(node.loc.start.offset + 1),
                  textDocument.positionAt(node.loc.end.offset - 1),
                ),
              } as AnnotatedTextEdit;
            });

      if (edits.length === 0) return null;

      return documentChanges(sourceCode, edits);
    };
  }

  private getSectionTagChanges(oldSectionName: string, newSectionName: string) {
    return async (sourceCode: AugmentedLiquidSourceCode) => {
      const { textDocument, ast } = sourceCode;
      if (isError(ast)) return null;

      const edits = visit<SourceCodeType.LiquidHtml, TextEdit>(ast, {
        LiquidTag(node) {
          if (node.name !== 'section') return;
          if (typeof node.markup === 'string') return;

          // Note the type assertion to the LHS of the expression.
          // The type assertions above are enough for this to be true.
          // But I'm making the explicit annotation here to make it clear.
          const typeNode: LiquidString = node.markup;
          if (typeNode.value !== oldSectionName) return;

          return {
            annotationId,
            newText: newSectionName,
            range: Range.create(
              textDocument.positionAt(typeNode.position.start + 1),
              textDocument.positionAt(typeNode.position.end - 1),
            ),
          };
        },
      });

      if (edits.length === 0) return null;

      return documentChanges(sourceCode, edits);
    };
  }
}

function documentChanges(sourceCode: AugmentedSourceCode, edits: TextEdit[]): DocumentChange {
  return {
    textDocument: {
      uri: sourceCode.uri,
      version: sourceCode.version ?? null /* null means file from disk in this API */,
    },
    edits,
  };
}
