import type { TagDefinition } from '../tag-definitions';
import { ifTag, unlessTag } from './if';
import { caseTag } from './case';
import { forTag, tablerowTag } from './for';
import { assignTag } from './assign';
import { echoTag } from './echo';
import { renderTag, includeTag } from './render';
import { cycleTag } from './cycle';
import { sectionTag } from './section';
import { contentForTag } from './content-for';
import { blockTag } from './block';
import { paginateTag } from './paginate';
import { formTag } from './form';
import { incrementTag } from './increment';
import { decrementTag } from './decrement';
import { captureTag } from './capture';
import { layoutTag } from './layout';
import { sectionsTag } from './sections';
import { partialTag } from './partial';
import { ifchangedTag } from './ifchanged';
import { breakTag } from './break';
import { continueTag } from './continue';
import {
  commentRaw,
  docRaw,
  rawRaw,
  javascriptRaw,
  schemaRaw,
  styleRaw,
  stylesheetRaw,
} from './raw';
import { liquidTag } from './liquid';

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
