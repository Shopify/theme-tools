import { Severity, SourceCodeType, type LiquidCheckDefinition } from '../../types';
import type { LiquidRawTag, LiquidTag, LiquidVariableOutput } from '@shopify/liquid-html-parser';
import { checkAssignTag } from './assign';
import { checkBaseTag } from './base';
import { checkBranchTag, checkMisplacedBranchTag } from './branch';
import { checkBlockParserError, checkBlockTag } from './block';
import { checkCaptureTag } from './capture';
import { checkCaseTag } from './case';
import { checkCommentRawTag, checkCommentTag } from './comment';
import { checkContentForTag } from './content-for';
import { checkCycleTag } from './cycle';
import { checkDecrementTag } from './decrement';
import { checkDocParserError, checkDocTag } from './doc';
import { checkEchoTag } from './echo';
import { checkFormTag } from './form';
import { checkForTag } from './for';
import { checkIfTag } from './if';
import { checkIncludeTag } from './include';
import { checkIncrementTag } from './increment';
import { checkInlineCommentTag } from './inline_comment';
import { checkJavascriptParserError, checkJavascriptTag } from './javascript';
import { checkLayoutTag } from './layout';
import { checkPaginateTag } from './paginate';
import { checkPartialParserError, checkPartialTag } from './partial';
import { checkRawParserError, checkRawTag } from './raw';
import { checkRenderTag } from './render';
import { checkSchemaTag } from './schema';
import { checkSectionsTag } from './sections';
import { checkSectionTag } from './section';
import { checkStyleTag } from './style';
import { checkStylesheetTag } from './stylesheet';
import { checkTablerowTag } from './tablerow';
import { checkUnlessTag } from './unless';
import { checkVariableOutput } from './variable';

export type Context = Parameters<LiquidCheckDefinition['create']>[0];

type TagChecker = (node: LiquidTag, context: Context) => void;
type RawTagChecker = (node: LiquidRawTag, context: Context) => void;

const noop = (_n: LiquidTag, _c: Context) => {};

const tagCheckers: Record<string, TagChecker> = {
  '#': checkInlineCommentTag,
  assign: checkAssignTag,
  block: checkBlockTag,
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
  partial: checkPartialTag,
  render: checkRenderTag,
  section: checkSectionTag,
  sections: checkSectionsTag,
  unless: checkUnlessTag,
};

const misplacedTagCheckers: Record<string, TagChecker> = {
  // Branch keywords reach this path only when they are out of context.
  else: checkMisplacedBranchTag,
  elsif: checkMisplacedBranchTag,
  when: checkMisplacedBranchTag,
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

export const LiquidSyntaxError: LiquidCheckDefinition = {
  meta: {
    code: 'LiquidSyntaxError',
    name: 'LiquidSyntaxError',
    docs: {
      description: 'Reports Liquid syntax errors.',
      recommended: true,
    },
    type: SourceCodeType.LiquidHtml,
    severity: Severity.ERROR,
    schema: {},
    targets: [],
  },
  create(context) {
    if (context.file.ast instanceof Error) {
      const error = context.file.ast as Error;
      return {
        async onCodePathStart(file) {
          checkCommentTag(error, context, file.source);
          checkBlockParserError(error, context, file.source);
          checkDocParserError(error, context, file.source);
          checkPartialParserError(error, context, file.source);
          checkRawParserError(error, context, file.source);
          checkJavascriptParserError(error, context, file.source);
        },
      };
    }

    return {
      async LiquidRawTag(node) {
        const rawTagCheck = rawTagCheckers[node.name];

        if (rawTagCheck) {
          rawTagCheck(node, context);
        }
      },

      async LiquidTag(node) {
        const tagCheck = tagCheckers[node.name] ?? misplacedTagCheckers[node.name];

        if (tagCheck) {
          tagCheck(node, context);
          return;
        }

        await checkBaseTag(node, context);
      },

      async LiquidBranch(node) {
        checkBranchTag(node, context);
      },

      async LiquidVariableOutput(node: LiquidVariableOutput) {
        checkVariableOutput(node, context);
      },
    };
  },
};
