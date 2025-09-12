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

  // Check for double pipes (| |) in the markup
  const doublePipePattern = /\|\s*\|\s*/g;
  const doublePipeMatches = Array.from(trimmedMarkup.matchAll(doublePipePattern));

  for (const match of doublePipeMatches) {
    const markupStartInSource = node.source.indexOf(markup, node.position.start);
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

  // Check for trailing pipes (| at the end) - work with node.source to capture trailing spaces
  const sourceContent = node.source;
  const trailingPipePattern = /\s*\|\s*(?=\s*(?:[}%]|$|[\r\n]))/g; // Match | followed by whitespace before closing }}, %, end of string, or newline
  const trailingPipeMatches = Array.from(sourceContent.matchAll(trailingPipePattern));

  for (const match of trailingPipeMatches) {
    const problemStartInSource = match.index!;
    const problemEndInSource = problemStartInSource + match[0].length;

    problems.push({
      message: `${INVALID_SYNTAX_MESSAGE} Trailing pipe detected. Remove the trailing pipe.`,
      startIndex: problemStartInSource,
      endIndex: problemEndInSource,
      fix: (corrector) => {
        corrector.replace(problemStartInSource, problemEndInSource, ' ');
      },
    });
  }

  return problems;
}
