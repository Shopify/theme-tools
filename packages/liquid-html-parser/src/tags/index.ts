import type { TagDefinition } from '../tag-definitions';
import { assignTag } from './assign';
import { blockTag } from './block';
import { breakTag } from './break';
import { captureTag } from './capture';
import { caseTag } from './case';
import { contentForTag } from './content-for';
import { continueTag } from './continue';
import { cycleTag } from './cycle';
import { decrementTag } from './decrement';
import { echoTag } from './echo';
import { forTag, tablerowTag } from './for';
import { formTag } from './form';
import { ifTag, unlessTag } from './if';
import { ifchangedTag } from './ifchanged';
import { incrementTag } from './increment';
import { layoutTag } from './layout';
import { liquidTag } from './liquid';
import { paginateTag } from './paginate';
import { partialTag } from './partial';
import {
  commentRaw,
  docRaw,
  javascriptRaw,
  rawRaw,
  schemaRaw,
  styleRaw,
  stylesheetRaw,
} from './raw';
import { includeTag, renderTag } from './render';
import { sectionTag } from './section';
import { sectionsTag } from './sections';

export const builtinTags = {
  assign: assignTag,
  block: blockTag,
  break: breakTag,
  capture: captureTag,
  case: caseTag,
  content_for: contentForTag,
  continue: continueTag,
  cycle: cycleTag,
  decrement: decrementTag,
  echo: echoTag,
  for: forTag,
  form: formTag,
  if: ifTag,
  ifchanged: ifchangedTag,
  include: includeTag,
  increment: incrementTag,
  layout: layoutTag,
  liquid: liquidTag,
  paginate: paginateTag,
  partial: partialTag,
  render: renderTag,
  section: sectionTag,
  sections: sectionsTag,
  tablerow: tablerowTag,
  unless: unlessTag,
  comment: commentRaw,
  doc: docRaw,
  javascript: javascriptRaw,
  raw: rawRaw,
  schema: schemaRaw,
  style: styleRaw,
  stylesheet: stylesheetRaw,
} as const satisfies Record<string, TagDefinition>;
