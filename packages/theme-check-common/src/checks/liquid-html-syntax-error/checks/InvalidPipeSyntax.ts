import { LiquidVariableOutput, LiquidTag, NodeTypes, NamedTags } from '@shopify/liquid-html-parser';
import { Problem, SourceCodeType } from '../../..';
import { INVALID_SYNTAX_MESSAGE } from './utils';

export async function detectInvalidPipeSyntax(
  node: LiquidVariableOutput | LiquidTag,
): Promise<Problem<SourceCodeType.LiquidHtml>[]> {
  if (node.type === NodeTypes.LiquidVariableOutput) {
    if (typeof node.markup !== 'string') {
      return [];
    }
    return detectPipeSyntaxInMarkup(node, node.markup);
  }

  if (node.type === NodeTypes.LiquidTag) {
    if (node.name === NamedTags.echo && typeof node.markup !== 'string') {
      return [];
    }
    if (node.name === NamedTags.assign && typeof node.markup !== 'string') {
      return [];
    }
    if (
      typeof node.markup === 'string' &&
      (node.name === NamedTags.echo || node.name === NamedTags.assign)
    ) {
      return detectPipeSyntaxInMarkup(node, node.markup);
    }
  }

  return [];
}

async function detectPipeSyntaxInMarkup(
  node: LiquidVariableOutput | LiquidTag,
  markup: string,
): Promise<Problem<SourceCodeType.LiquidHtml>[]> {
  const problems: Problem<SourceCodeType.LiquidHtml>[] = [];
  const trimmedMarkup = markup.trim();

  // Check for double pipes
  const doublePipePattern = /\|\s*\|\s*/g;
  const doublePipeMatches = Array.from(trimmedMarkup.matchAll(doublePipePattern));

  for (const match of doublePipeMatches) {
    const markupStartInSource = node.source.indexOf(markup, node.position.start);
    if (markupStartInSource === -1) {
      continue;
    }
    const problemStartInSource = markupStartInSource + match.index!;
    const problemEndInSource = problemStartInSource + match[0].length;

    problems.push({
      message: `${INVALID_SYNTAX_MESSAGE} Double pipe detected. Remove the extra pipe.`,
      startIndex: problemStartInSource,
      endIndex: problemEndInSource,
      fix: (corrector) => {
        corrector.replace(problemStartInSource, problemEndInSource, '| ');
      },
    });
  }

  // Check for trailing pipes
  const trailingPipePattern = /\s*\|\s*$/;
  const trailingPipeMatch = trimmedMarkup.match(trailingPipePattern);

  if (trailingPipeMatch) {
    const markupStartInSource = node.source.indexOf(markup, node.position.start);
    if (markupStartInSource === -1) {
      return problems;
    }
    const trailingPipeStartInMarkup = trailingPipeMatch.index!;
    const problemStartInSource = markupStartInSource + trailingPipeStartInMarkup;
    const problemEndInSource = problemStartInSource + trailingPipeMatch[0].length;

    problems.push({
      message: `${INVALID_SYNTAX_MESSAGE} Trailing pipe detected. Remove the trailing pipe.`,
      startIndex: problemStartInSource,
      endIndex: problemEndInSource,
      fix: (corrector) => {
        corrector.replace(problemStartInSource, problemEndInSource, '');
      },
    });
  }

  return problems;
}
