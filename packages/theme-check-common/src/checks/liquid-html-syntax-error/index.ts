import {
  Severity,
  SourceCodeType,
  LiquidCheckDefinition,
  Problem,
  Context,
  type LiquidHtmlNode,
} from '../../types';
import { getOffset, getPosition, isError } from '../../utils';
import { detectMultipleAssignValues } from './checks/MultipleAssignValues';
import { detectInvalidBooleanExpressions } from './checks/InvalidBooleanExpressions';
import { detectInvalidEchoValue } from './checks/InvalidEchoValue';
import { detectInvalidConditionalNode } from './checks/InvalidConditionalNode';
import { detectInvalidLoopRange } from './checks/InvalidLoopRange';
import { detectInvalidLoopArguments } from './checks/InvalidLoopArguments';
import { detectConditionalNodeUnsupportedParenthesis } from './checks/InvalidConditionalNodeParenthesis';
import { detectInvalidFilterName } from './checks/InvalidFilterName';
import { detectInvalidPipeSyntax } from './checks/InvalidPipeSyntax';
import { isWithinRawTagThatDoesNotParseItsContents } from '../utils';
import {
  checkAssignTag,
  checkBaseTag,
  checkBranchTag,
  checkCaptureTag,
  checkCaseTag,
  checkCommentRawTag,
  checkCommentSourceStructure,
  checkCommentTag,
  checkContentForTag,
  checkCycleTag,
  checkDecrementTag,
  checkDocParserError,
  checkDocSourceStructure,
  checkDocTag,
  checkEchoTag,
  checkForTag,
  checkFormTag,
  checkIfTag,
  checkIncludeTag,
  checkIncrementTag,
  checkInlineCommentTag,
  checkJavascriptParserError,
  checkJavascriptSourceStructure,
  checkJavascriptTag,
  checkLayoutTag,
  checkMisplacedElsifTag,
  checkPaginateTag,
  checkRawParserError,
  checkRawSourceStructure,
  checkRawTag,
  checkRenderTag,
  checkSchemaSourceStructure,
  checkSchemaTag,
  checkSectionTag,
  checkSectionsTag,
  checkStylesheetTag,
  checkStyleTag,
  checkTablerowTag,
  checkUnlessTag,
  checkVariableOutput,
  type LiquidRawTag,
  type LiquidTag,
  type LiquidVariableOutput,
} from './checks/liquid-syntax-error';

type LineColPosition = {
  line: number;
  column: number;
};

type LiquidHtmlProblem = Problem<SourceCodeType.LiquidHtml>;
type LiquidHtmlContext = Context<SourceCodeType.LiquidHtml>;
type TagChecker = (node: LiquidTag, context: LiquidHtmlContext) => void;
type RawTagChecker = (node: LiquidRawTag, context: LiquidHtmlContext) => void;
type LiquidSyntaxVisitors = {
  onCodePathStart?: (file: LiquidHtmlContext['file']) => Promise<void>;
  LiquidRawTag?: (node: LiquidRawTag, ancestors: LiquidHtmlNode[]) => Promise<void>;
  LiquidTag?: (node: LiquidTag, ancestors: LiquidHtmlNode[]) => Promise<void>;
  LiquidBranch?: (
    node: Parameters<typeof checkBranchTag>[0],
    ancestors: LiquidHtmlNode[],
  ) => Promise<void>;
  LiquidVariableOutput?: (node: LiquidVariableOutput, ancestors: LiquidHtmlNode[]) => Promise<void>;
};

const noop = (_n: LiquidTag, _c: LiquidHtmlContext) => {};

const tagCheckers: Record<string, TagChecker> = {
  '#': checkInlineCommentTag,
  assign: checkAssignTag,
  break: noop,
  capture: checkCaptureTag,
  case: checkCaseTag,
  continue: noop,
  content_for: checkContentForTag,
  cycle: checkCycleTag,
  decrement: checkDecrementTag,
  echo: checkEchoTag,
  form: checkFormTag,
  for: checkForTag,
  tablerow: checkTablerowTag,
  if: checkIfTag,
  ifchanged: noop,
  include: checkIncludeTag,
  increment: checkIncrementTag,
  layout: checkLayoutTag,
  paginate: checkPaginateTag,
  render: checkRenderTag,
  section: checkSectionTag,
  sections: checkSectionsTag,
  unless: checkUnlessTag,
};

const misplacedTagCheckers: Record<string, TagChecker> = {
  // Branch keywords reach this path only when they are out of context.
  elsif: checkMisplacedElsifTag,
};

const rawTagCheckers: Record<string, RawTagChecker> = {
  comment: checkCommentRawTag,
  doc: checkDocTag,
  javascript: checkJavascriptTag,
  schema: checkSchemaTag,
  style: checkStyleTag,
  stylesheet: checkStylesheetTag,
  raw: checkRawTag,
};

const COMMENT_SOURCE_STRUCTURE_TAGS = new Set(['comment', 'endcomment', 'raw', 'endraw']);
const JAVASCRIPT_SOURCE_STRUCTURE_TAGS = new Set(['javascript', 'endjavascript']);
const SCHEMA_SOURCE_STRUCTURE_TAGS = new Set(['schema']);
const RAW_SOURCE_STRUCTURE_TAGS = new Set(['raw', 'endraw']);
const DOC_SOURCE_STRUCTURE_TAGS = new Set(['doc', 'enddoc']);

function isParsingErrorWithLocation(
  error: Error,
): error is Error & { loc: { start: LineColPosition; end: LineColPosition } } {
  return 'name' in error && error.name === 'LiquidHTMLParsingError' && 'loc' in error;
}

function cleanErrorMessage(message: string, highlight: string): string {
  return message
    .replace(/Line \d+, col \d+:\s+/, 'SyntaxError: ')
    .replace(/(?!<expected ".+",) not .*/, ` not "${highlight}"`);
}

function diagnosticLine(source: string, problem: LiquidHtmlProblem): number {
  const start = getPosition(source, problem.startIndex);
  return start.line;
}

function reportProblem(
  context: LiquidHtmlContext,
  reportedProblemLines: Set<number>,
  problem: LiquidHtmlProblem,
) {
  reportedProblemLines.add(diagnosticLine(context.file.source, problem));
  context.report(problem);
}

function contextWithDedupedReports(
  context: LiquidHtmlContext,
  reportedProblemLines: Set<number>,
): LiquidHtmlContext {
  return {
    ...context,
    report(problem) {
      if (isExistingConditionalParserResponsibility(problem)) return;

      const line = diagnosticLine(context.file.source, problem);
      if (reportedProblemLines.has(line)) return;

      reportedProblemLines.add(line);
      context.report(problem);
    },
  };
}

function isExistingConditionalParserResponsibility(problem: LiquidHtmlProblem): boolean {
  return /^Syntax error in '(if|unless|elsif)' tag$/.test(problem.message);
}

function hasBooleanExpressionMarkup(node: { markup: unknown }): boolean {
  return (
    typeof node.markup === 'object' &&
    node.markup !== null &&
    'expression' in node.markup &&
    (node.markup as { expression?: { type?: string } }).expression?.type === 'BooleanExpression'
  );
}

function withLiquidSyntaxCompatNode<
  Node extends { type: string; source: string; position: LineRange },
>(node: Node): Node & { markupPosition: LineRange } {
  if ('markupPosition' in node) return node as Node & { markupPosition: LineRange };

  const compatNode = {
    ...node,
    position: liquidBlockStatementPosition(node) ?? node.position,
    markupPosition:
      node.type === 'LiquidVariableOutput'
        ? variableOutputMarkupPosition(node)
        : liquidTagMarkupPosition(node),
  };

  return compatNode;
}

function variableOutputMarkupPosition(node: { source: string; position: LineRange }): LineRange {
  const { source, position } = node;
  const openLength = source.startsWith('{{-', position.start) ? 3 : 2;
  const closeLength = source.slice(position.end - 3, position.end) === '-}}' ? 3 : 2;

  return {
    start: position.start + openLength,
    end: position.end - closeLength,
  };
}

function liquidTagMarkupPosition(node: {
  source: string;
  name?: string | null;
  position: LineRange;
  blockStartPosition?: LineRange;
}): LineRange {
  const { source } = node;
  const position = node.blockStartPosition ?? node.position;
  const hasLiquidTagDelimiters = source.startsWith('{%', position.start);
  const openLength = hasLiquidTagDelimiters
    ? source.startsWith('{%-', position.start)
      ? 3
      : 2
    : 0;
  const closeLength = hasLiquidTagDelimiters
    ? source.slice(position.end - 3, position.end) === '-%}'
      ? 3
      : 2
    : 0;
  const contentStart = position.start + openLength;
  const contentEnd = position.end - closeLength;
  const content = source.slice(contentStart, contentEnd);

  if (!node.name) {
    return { start: contentStart, end: contentEnd };
  }

  const tagNameMatch = content.match(tagNamePattern(node.name));
  return {
    start: contentStart + (tagNameMatch?.[0].length ?? 0),
    end: contentEnd,
  };
}

function liquidBlockStatementPosition(node: {
  type: string;
  source: string;
  blockStartPosition?: LineRange;
}): LineRange | undefined {
  if (node.type !== 'LiquidTag' || !node.blockStartPosition) return;
  if (node.source.startsWith('{%', node.blockStartPosition.start)) return;

  return node.blockStartPosition;
}

function tagNamePattern(name: string): RegExp {
  const boundary = /\w$/.test(name) ? '\\b' : '';
  return new RegExp(`^\\s*${escapeRegExp(name)}${boundary}`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createLiquidSyntaxVisitors(context: LiquidHtmlContext): LiquidSyntaxVisitors {
  let checkedCommentSourceStructure = false;
  let checkedJavascriptSourceStructure = false;
  let checkedSchemaSourceStructure = false;
  let checkedRawSourceStructure = false;
  let checkedDocSourceStructure = false;
  const checkCommentSourceStructureOnce = (source: string) => {
    if (checkedCommentSourceStructure) return;
    checkedCommentSourceStructure = true;
    checkCommentSourceStructure(source, context);
  };
  const checkJavascriptSourceStructureOnce = (source: string) => {
    if (checkedJavascriptSourceStructure) return;
    checkedJavascriptSourceStructure = true;
    checkJavascriptSourceStructure(source, context);
  };
  const checkSchemaSourceStructureOnce = (source: string) => {
    if (checkedSchemaSourceStructure) return;
    checkedSchemaSourceStructure = true;
    checkSchemaSourceStructure(source, context);
  };
  const checkRawSourceStructureOnce = (source: string) => {
    if (checkedRawSourceStructure) return;
    checkedRawSourceStructure = true;
    checkRawSourceStructure(source, context);
  };
  const checkDocSourceStructureOnce = (source: string) => {
    if (checkedDocSourceStructure) return;
    checkedDocSourceStructure = true;
    checkDocSourceStructure(source, context);
  };

  if (context.file.ast instanceof Error) {
    const error = context.file.ast as Error;
    return {
      async onCodePathStart(file: LiquidHtmlContext['file']) {
        checkCommentSourceStructureOnce(file.source);
        checkJavascriptSourceStructureOnce(file.source);
        checkSchemaSourceStructureOnce(file.source);
        checkRawSourceStructureOnce(file.source);
        checkDocSourceStructureOnce(file.source);
        checkCommentTag(error, context, file.source);
        checkDocParserError(error, context, file.source);
        checkRawParserError(error, context, file.source);
        checkJavascriptParserError(error, context, file.source);
      },
    };
  }

  return {
    async LiquidRawTag(node: LiquidRawTag) {
      const rawTagCheck = rawTagCheckers[node.name];

      if (node.name === 'javascript') {
        checkJavascriptSourceStructureOnce(node.source);
      }

      if (node.name === 'schema') {
        checkSchemaSourceStructureOnce(node.source);
      }

      if (node.name === 'raw') {
        checkRawSourceStructureOnce(node.source);
      }

      if (node.name === 'doc') {
        checkDocSourceStructureOnce(node.source);
      }

      if (rawTagCheck) {
        rawTagCheck(node, context);
      }
    },

    async LiquidTag(node: LiquidTag) {
      if (COMMENT_SOURCE_STRUCTURE_TAGS.has(node.name)) {
        checkCommentSourceStructureOnce(node.source);
      }

      if (JAVASCRIPT_SOURCE_STRUCTURE_TAGS.has(node.name)) {
        checkJavascriptSourceStructureOnce(node.source);
      }

      if (SCHEMA_SOURCE_STRUCTURE_TAGS.has(node.name)) {
        checkSchemaSourceStructureOnce(node.source);
      }

      if (RAW_SOURCE_STRUCTURE_TAGS.has(node.name)) {
        checkRawSourceStructureOnce(node.source);
      }

      if (DOC_SOURCE_STRUCTURE_TAGS.has(node.name)) {
        checkDocSourceStructureOnce(node.source);
      }

      const tagCheck = tagCheckers[node.name] ?? misplacedTagCheckers[node.name];

      if (tagCheck) {
        tagCheck(node, context);
        return;
      }

      checkBaseTag(node, context);
    },

    async LiquidBranch(node: Parameters<typeof checkBranchTag>[0], ancestors: LiquidHtmlNode[]) {
      checkBranchTag(node, context, ancestors);
    },

    async LiquidVariableOutput(node: LiquidVariableOutput) {
      checkVariableOutput(node, context);
    },
  };
}

type LineRange = {
  start: number;
  end: number;
};

export const LiquidHTMLSyntaxError: LiquidCheckDefinition = {
  meta: {
    code: 'LiquidHTMLSyntaxError',
    aliases: ['SyntaxError', 'HtmlParsingError'],
    name: 'Prevent LiquidHTML Syntax Errors',
    docs: {
      description: 'This check exists to inform the user of Liquid HTML syntax errors.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },

  create(context) {
    const ast = context.file.ast;
    const filtersPromise = context.themeDocset?.filters();
    const tagsPromise = context.themeDocset?.tags();
    const reportedProblemLines = new Set<number>();
    const liquidSyntaxVisitors = createLiquidSyntaxVisitors(
      contextWithDedupedReports(context, reportedProblemLines),
    );

    if (!isError(ast)) {
      return {
        async BooleanExpression(node, ancestors) {
          if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

          const problem = detectInvalidBooleanExpressions(node, ancestors);

          if (!problem) {
            return;
          }

          reportProblem(context, reportedProblemLines, problem);
        },
        async LiquidTag(node, ancestors) {
          if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

          const problems = [
            detectMultipleAssignValues(node),
            detectInvalidEchoValue(node),
            detectInvalidLoopRange(node),
            detectInvalidLoopArguments(node, await tagsPromise),
          ].filter(Boolean) as Problem<SourceCodeType.LiquidHtml>[];

          // Fixers for `detectConditionalNodeUnsupportedParenthesis` and `detectInvalidConditionalNode` consume
          // the whole node markup, so we MUST not run both.
          const conditionalNodeProblem =
            detectConditionalNodeUnsupportedParenthesis(node) || detectInvalidConditionalNode(node);

          if (conditionalNodeProblem) {
            problems.push(conditionalNodeProblem);
          }

          problems.forEach((problem) => reportProblem(context, reportedProblemLines, problem));

          const filterProblems = await detectInvalidFilterName(node, await filtersPromise);
          if (filterProblems.length > 0) {
            filterProblems.forEach((filterProblem) =>
              reportProblem(context, reportedProblemLines, filterProblem),
            );
          }

          const pipeProblems = await detectInvalidPipeSyntax(node);
          if (pipeProblems.length > 0) {
            pipeProblems.forEach((pipeProblem) =>
              reportProblem(context, reportedProblemLines, pipeProblem),
            );
          }

          await liquidSyntaxVisitors.LiquidTag?.(withLiquidSyntaxCompatNode(node), ancestors);
        },

        async LiquidBranch(node, ancestors) {
          if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

          const problem = detectInvalidConditionalNode(node);

          if (problem) {
            reportProblem(context, reportedProblemLines, problem);
          }

          await liquidSyntaxVisitors.LiquidBranch?.(withLiquidSyntaxCompatNode(node), ancestors);
        },

        async LiquidVariableOutput(node, ancestors) {
          if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

          const filterProblems = await detectInvalidFilterName(node, await filtersPromise);
          if (filterProblems.length > 0) {
            filterProblems.forEach((problem) =>
              reportProblem(context, reportedProblemLines, problem),
            );
          }

          const pipeProblems = await detectInvalidPipeSyntax(node);
          if (pipeProblems.length > 0) {
            pipeProblems.forEach((pipeProblem) =>
              reportProblem(context, reportedProblemLines, pipeProblem),
            );
          }

          const problem = detectInvalidEchoValue(node);
          if (problem) {
            reportProblem(context, reportedProblemLines, problem);
          }

          if (!hasBooleanExpressionMarkup(node)) {
            await liquidSyntaxVisitors.LiquidVariableOutput?.(
              withLiquidSyntaxCompatNode(node),
              ancestors,
            );
          }
        },

        async LiquidRawTag(node, ancestors) {
          if (isWithinRawTagThatDoesNotParseItsContents(ancestors)) return;

          await liquidSyntaxVisitors.LiquidRawTag?.(withLiquidSyntaxCompatNode(node), ancestors);
        },
      };
    }

    return {
      async onCodePathStart(file) {
        if (isParsingErrorWithLocation(ast)) {
          const { start, end } = ast.loc;
          const startIndex = getOffset(file.source, start.line, start.column);
          let endIndex = getOffset(file.source, end.line, end.column);
          if (startIndex === endIndex) endIndex += 1;
          const highlight = file.source.slice(startIndex, endIndex);
          reportProblem(context, reportedProblemLines, {
            message: cleanErrorMessage(ast.message, highlight),
            startIndex,
            endIndex: endIndex,
          });
        } else {
          reportProblem(context, reportedProblemLines, {
            message: ast.message,
            startIndex: 0,
            endIndex: file.source.length,
          });
        }

        await liquidSyntaxVisitors.onCodePathStart?.(file);
      },
    };
  },
};
