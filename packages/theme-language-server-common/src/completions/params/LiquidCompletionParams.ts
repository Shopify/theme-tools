import {
  findErrorNodeAtOffset,
  LiquidHtmlNode,
  LiquidTag,
  NodeTypes,
  Position,
  RAW_TAGS,
  VOID_ELEMENTS,
  toTolerantLiquidHtmlAST,
} from '@shopify/liquid-html-parser';
import { CompletionParams } from 'vscode-languageserver';
import { AugmentedLiquidSourceCode, AugmentedSourceCode } from '../../documents';
import { isNamedHtmlElementNode } from '../../utils';
import { completionPartial } from '../providers/common';

interface CompletionContext {
  /** The full resilient AST of the original source */
  readonly partialAst: LiquidHtmlNode;

  /** The node at the cursor position, undefined if cursor is not in a node */
  readonly node: LiquidHtmlNode | undefined;

  /** The ancestry that leads to the current node */
  readonly ancestors: LiquidHtmlNode[];

  /** The character offset of the cursor within the source */
  readonly cursor: number;

  /** The source text between the current node's start and the cursor */
  readonly partial: string;
}

export interface LiquidCompletionParams extends CompletionParams {
  /**
   * The completion context represents additional information that would
   * allow you to offer completions at the cursor position.
   *
   * If undefined, then the file is unparseable.
   */
  readonly completionContext: CompletionContext | undefined;

  /** The document from the document manager */
  readonly document: AugmentedLiquidSourceCode;
}

export function createLiquidCompletionParams(
  sourceCode: AugmentedLiquidSourceCode,
  params: CompletionParams,
): LiquidCompletionParams {
  const { textDocument } = sourceCode;
  const cursor = textDocument.offsetAt(params.position);
  const completionContext = getCompletionContext(sourceCode, cursor);

  return {
    ...params,
    completionContext,
    document: sourceCode,
  };
}

function getCompletionContext(
  sourceCode: AugmentedSourceCode,
  cursor: number,
): CompletionContext | undefined {
  const partialAst = parseResilient(sourceCode);
  if (!partialAst) {
    return undefined;
  }

  const [node, ancestors] = findCompletionNode(partialAst, cursor, sourceCode.source);
  const partial = completionPartial(node, cursor, sourceCode.source);
  return {
    partialAst,
    ancestors,
    node,
    cursor,
    partial,
  };
}

/**
 * This function returns the full resilient AST of the original source.
 *
 * Unlike the old fix-and-truncate approach (which rewrote the source to be
 * parseable and then truncated it at the caret), we now parse the entire
 * source with `toTolerantLiquidHtmlAST`. Its default options recover a
 * usable AST even when the source has parse errors, so failed regions become
 * `LiquidErrorNode`s rather than aborting the whole parse.
 *
 * The result is a complete AST; the node under the cursor is then located by
 * `findCompletionNode`, keyed on trustworthy positions rather than on the
 * source being truncated at the caret.
 */
function parseResilient(sourceCode: AugmentedSourceCode): LiquidHtmlNode | undefined {
  try {
    return toTolerantLiquidHtmlAST(sourceCode.source);
  } catch (err: any) {
    // We swallow errors here, because we gracefully accept that and
    // simply don't offer completions when that happens.
    return undefined;
  }
}

class Finder {
  public stack: NonEmptyArray<LiquidHtmlNode | undefined>;

  constructor(ast: LiquidHtmlNode) {
    this.stack = [ast];
  }

  get current(): LiquidHtmlNode | undefined {
    return last(this.stack);
  }

  get parent(): LiquidHtmlNode | undefined {
    return this.stack.at(-2);
  }

  set current(node: LiquidHtmlNode | undefined) {
    this.stack.push(node);
  }
}

/**
 * @returns the node at the cursor position and its ancestry.
 *
 * Undefined when you're not really on a node (there's nothing to complete)
 */
function findCompletionNode(
  partialAst: LiquidHtmlNode,
  cursor: number,
  source: string,
): [node: LiquidHtmlNode | undefined, ancestry: LiquidHtmlNode[]] {
  const finder = new Finder(partialAst);
  let current: LiquidHtmlNode = { ...partialAst };

  // Our objective:
  //   Finding the deepest real typed node whose `position` covers the
  //   cursor, together with its ancestor chain.
  //
  // Context:
  //   The resilient parser gives us the AST of the whole source (not a copy
  //   truncated at the caret), so we can no longer assume the node under the
  //   cursor is the "last-most" node. Instead we descend, at each node,
  //   into the child whose `position` covers the cursor. That keeps the
  //   per-type intent (which child to consider, in which order) but keys the
  //   selection on trustworthy positions.
  //
  // How we do it:
  //   We define logic per node type. For example, HTML tags will do this:
  //     - If the node is closed (<a>child</a>),
  //         then there's nothing to complete.
  //         We return undefined
  //     - If the node has children,
  //         then we visit the covering child
  //     - If the node has attributes,
  //         then we visit the covering attribute
  //     - If the node has a name,
  //         then we visit the covering name node (<a--{{ product.id }}>)
  //
  //   It's different per node type, because each node type has a different
  //   concept of child node and because they have to be traversed in a
  //   specific order.
  while (finder.current !== undefined && current !== finder.current) {
    current = finder.current;

    switch (current.type) {
      case NodeTypes.Document: {
        if (hasNonEmptyArrayProperty(current, 'children')) {
          finder.current = covering(current.children, cursor);
        }
        break;
      }

      case NodeTypes.HtmlRawNode:
      case NodeTypes.HtmlVoidElement:
      case NodeTypes.HtmlDanglingMarkerClose:
      case NodeTypes.HtmlSelfClosingElement:
      case NodeTypes.HtmlElement: {
        const child = hasNonEmptyArrayProperty(current, 'children')
          ? covering(current.children, cursor)
          : undefined;
        if (child) {
          // The cursor is inside the element body: descend into the covering
          // child even when the element itself is closed.
          finder.current = child;
        } else {
          const coveringAttr = hasNonEmptyArrayProperty(current, 'attributes')
            ? covering(current.attributes, cursor)
            : undefined;
          const coveringName =
            hasNonEmptyArrayProperty(current, 'name') &&
            isCoveredExcluded(cursor, current.blockStartPosition)
              ? covering(current.name, cursor)
              : undefined;
          if (coveringAttr) {
            // Descend into the covered attribute even when the open tag is
            // `>`-terminated (`<text titl>`): a zero-width blockEndPosition
            // makes isCompletedTag true, but the caret is in the attribute
            // region, so the attribute is the thing to complete.
            finder.current = coveringAttr;
          } else if (coveringName) {
            finder.current = coveringName;
          } else if (
            isNamedHtmlElementNode(current) &&
            isCoveredExcluded(cursor, current.blockStartPosition)
          ) {
            // The caret sits in an empty attribute slot of an open tag
            // (`<a █>`): no attribute node exists yet. Synthesize the empty slot
            // the attribute provider completes against.
            finder.current = {
              type: NodeTypes.AttrEmpty,
              name: [
                {
                  type: NodeTypes.TextNode,
                  value: '',
                  position: { start: cursor, end: cursor },
                },
              ],
              position: { start: cursor, end: cursor },
            } as any as LiquidHtmlNode;
          } else if (isCompletedTag(current)) {
            finder.current = undefined;
          } else if (hasNonEmptyArrayProperty(current, 'attributes')) {
            finder.current = covering(current.attributes, cursor);
          } else if (
            hasNonEmptyArrayProperty(current, 'name') &&
            isCoveredExcluded(cursor, current.blockStartPosition)
          ) {
            finder.current = covering(current.name, cursor);
          } else if (
            typeof current.name === 'string' &&
            isCoveredExcluded(cursor, current.blockStartPosition)
          ) {
            /* break */
          } else {
            finder.current = undefined; // there's nothing to complete
          }
        }

        break;
      }

      case NodeTypes.LiquidTag: {
        const child = hasNonEmptyArrayProperty(current, 'children')
          ? covering(current.children, cursor)
          : undefined;
        if (child) {
          // The cursor is inside the block body: descend into the covering
          // child even when the block is closed ({% if %}…{% endif %}).
          finder.current = child;
        } else if (
          isLiquidLiquidTag(finder.current) ||
          isCoveredExcluded(cursor, current.blockStartPosition) || // wouldn't want to complete {% if cond %} after the }.
          (isInLiquidLiquidTagContext(finder) && isCovered(cursor, current.blockStartPosition))
        ) {
          if (isTrailingLiquidTagMarkupSlot(current, cursor, source)) {
            // Keep the covering LiquidTag for trailing tag-modifier positions
            // (`{% for x in y reversed ^ %}`) so the tag provider sees the
            // same params shape Ohm exposed.
          } else if (
            hasNonNullProperty(current, 'markup') &&
            typeof current.markup !== 'string' &&
            hasTrailingEmptyFilterSlot(current.markup, cursor, source)
          ) {
            /*
             * The tolerant parser keeps a bare trailing `|` inside the markup
             * span (`{% echo x | ^ %}`, `{% assign v = x | ^ %}`), so the markup
             * COVERS the caret and the branch below would descend into the
             * pre-pipe variable and complete an object. Route the empty filter
             * slot to the filter subtree so the filter providers fire.
             * `synthTagFilterSlot` takes the tag (`current`) and re-derives the
             * expression from source (handling the `assign` `=`), so the
             * AssignMarkup wrapper needs no special handling here.
             */
            const slot = synthTagFilterSlot(current, cursor, source);
            if (slot) finder.current = slot;
          } else if (hasNonNullProperty(current, 'markup') && typeof current.markup !== 'string') {
            if (Array.isArray(current.markup)) {
              finder.current = covering(current.markup, cursor);
            } else if (isCovered(cursor, current.markup.position)) {
              finder.current = current.markup;
            } else if (
              current.markup.position.start > cursor &&
              isInExpressionSlot(current, cursor, source)
            ) {
              /*
               * The parser mis-absorbed an abutting end tag as this tag's
               * condition markup (`{% if ^{% endif %}`,
               * `{% unless ^{% endunless %}`): the markup node lives entirely
               * downstream of the caret, so it covers nothing here. Recover the
               * empty expression slot at the caret so the object provider fires,
               * matching the old parser's sentinel behaviour instead of
               * completing the bare tag name.
               */
              finder.current = synthMarkupSlot(current, cursor, source);
            }
          } else if (
            typeof current.markup === 'string' &&
            isInExpressionSlot(current, cursor, source) &&
            !isTrailingLiquidTagMarkupSlot(current, cursor, source)
          ) {
            // The parser left the markup as a raw string, meaning the
            // expression slot at the caret is empty or unfinished
            // (`{% echo ^ %}`, `{% if a > ^ %}`). Synthesize the node that slot
            // expects so the providers can offer completions there. The
            // `isInExpressionSlot` guard keeps caret-on-the-tag-name cases
            // (`{% ren^ %}`) completing the tag rather than a lookup.
            if (source.slice(current.position.start, cursor).includes('|')) {
              /*
               * A pipe in the tag's post-name region means the caret sits in a
               * filter or filter-argument slot (`{% echo s | ^ %}`,
               * `{% assign x = "s" | ^ %}`), not an object slot. Route to the
               * filter subtree so the filter providers fire instead of the
               * object provider, skipping the `synthMarkupSlot` / content_for
               * path.
               */
              finder.current = synthTagFilterSlot(current, cursor, source);
            } else {
              const slot = synthMarkupSlot(current, cursor, source);
              const contentForType =
                current.name === 'content_for'
                  ? synthContentForType(current, cursor, source)
                  : undefined;
              if (
                current.name === 'content_for' &&
                slot.type === NodeTypes.VariableLookup &&
                contentForType !== undefined
              ) {
                // The resilient parser leaves `{% content_for "b", partial %}` (a
                // bare arg name, no colon) as raw string markup — there is no
                // ContentForMarkup node for the parameter provider to hang off.
                // Synthesize one as the recovered lookup's parent so the provider
                // fires, mirroring the shape the parser builds for a well-formed
                // `type: "x"` argument.
                finder.current = {
                  type: NodeTypes.ContentForMarkup,
                  contentForType,
                  args: [],
                  position: current.position,
                } as any as LiquidHtmlNode;
              }
              finder.current = slot;
            }
          } else {
            // No markup, or the caret is still on the tag name: the tag itself
            // is the thing to complete.
            // finder.current = finder.current;
          }
        } else {
          finder.current = undefined; // we're done and there's nothing to complete
        }
        break;
      }

      case NodeTypes.LiquidBranch: {
        const child = hasNonEmptyArrayProperty(current, 'children')
          ? covering(current.children, cursor)
          : undefined;
        if (child) {
          finder.current = child;
        } else if (
          isCovered(cursor, current.blockStartPosition) &&
          typeof current.markup !== 'string'
        ) {
          if (Array.isArray(current.markup)) {
            const covered = covering(current.markup, cursor);
            if (covered) {
              finder.current = covered;
            } else if (
              isNotEmpty(current.markup) &&
              current.markup[0].position.start > cursor &&
              isInExpressionSlot(current, cursor, source)
            ) {
              /*
               * A `when` branch abutting its `{% endcase %}`
               * (`{% case x %}{% when ^{% endcase %}`): the resilient parser
               * mis-absorbs the end tag as this branch's condition, so every
               * markup element lives downstream of the caret and covers nothing
               * here. Recover the empty expression slot so the object provider
               * fires, mirroring the LiquidTag abutting-endtag arm and matching
               * the old parser instead of returning zero completions.
               */
              finder.current = synthMarkupSlot(current, cursor, source);
            } else {
              finder.current = undefined;
            }
          } else if (isCovered(cursor, current.markup.position)) {
            finder.current = current.markup;
          } else if (
            current.markup.position.start > cursor &&
            isInExpressionSlot(current, cursor, source)
          ) {
            /*
             * An `elsif` branch abutting its `{% endif %}`
             * (`{% if a %}{% elsif ^{% endif %}`): the mis-absorbed end tag
             * became this branch's single condition node, sitting entirely
             * downstream of the caret. Recover the empty slot as above so the
             * object provider offers completions rather than nothing.
             */
            finder.current = synthMarkupSlot(current, cursor, source);
          } else {
            finder.current = undefined;
          }
        } else if (
          typeof current.markup === 'string' &&
          isInExpressionSlot(current, cursor, source)
        ) {
          /*
           * The parser left the branch markup a raw string, so the expression
           * slot at the caret is empty (`{% elsif ^ %}`, `{% when ^ %}`). Mirror
           * the `LiquidTag` arm and synthesize the lookup that slot expects.
           * `synthMarkupSlot` sees an `elsif`/`when` name (not render/content_for)
           * and recovers a `VariableLookup`; the `isInExpressionSlot` guard keeps
           * caret-on-the-branch-name cases from synthesizing a lookup.
           */
          finder.current = synthMarkupSlot(current, cursor, source);
        } else {
          finder.current = undefined; // there's nothing to complete
        }
        break;
      }

      case NodeTypes.LiquidRawTag:
        if (current.name === 'doc' && current.body.nodes.length > 0) {
          finder.current = current.body.nodes.at(-1);
        }
        break;

      case NodeTypes.AttrDoubleQuoted:
      case NodeTypes.AttrSingleQuoted:
      case NodeTypes.AttrEmpty:
      case NodeTypes.AttrUnquoted: {
        const lastNameNode =
          covering(current.name, cursor) ??
          last(current.name as NonEmptyArray<(typeof current.name)[number]>); // there's at least one... guaranteed.
        if (isCovered(cursor, lastNameNode.position)) {
          finder.current = lastNameNode;
        } else if (
          current.type !== NodeTypes.AttrEmpty &&
          isCovered(cursor, current.attributePosition) &&
          isNotEmpty(current.value)
        ) {
          finder.current = last(current.value);
        } else {
          finder.current = undefined;
        }
        break;
      }

      case NodeTypes.YAMLFrontmatter:
      case NodeTypes.HtmlDoctype:
      case NodeTypes.HtmlComment:
      case NodeTypes.RawMarkup: {
        break;
      }

      case NodeTypes.LiquidVariableOutput: {
        const emptyFilterSlot =
          typeof current.markup !== 'string' &&
          hasTrailingEmptyFilterSlot(current.markup, cursor, source)
            ? synthOutputFilterSlot(current, cursor, source)
            : undefined;
        if (emptyFilterSlot) {
          /*
           * The tolerant parser keeps a bare trailing `|` inside the markup span
           * (`{{ x | ^ }}`, `{{ x | upcase | ^ }}`), so the markup covers the
           * caret and the descent below would complete the pre-pipe expression.
           * Route to the filter subtree so the filter providers fire.
           */
          finder.current = emptyFilterSlot;
        } else if (
          typeof current.markup !== 'string' &&
          isCovered(cursor, current.markup.position)
        ) {
          finder.current = current.markup;
        } else if (typeof current.markup === 'string') {
          // The parser left the output markup as a raw string, so the filter
          // or filter-argument slot at the caret is empty (`{{ x | ^ }}`,
          // `{{ x | image_url: ^ }}`). Synthesize the `LiquidVariable` subtree
          // that slot expects and let the descent below walk it to the empty
          // filter / argument leaf. Returns undefined for a pipe-less output
          // (`{{ ^ }}`), leaving the previous behaviour intact.
          const variable = synthOutputFilterSlot(current, cursor, source);
          if (variable) {
            finder.current = variable;
          } else {
            // Pipe-less raw-string output (`{{ x.^ }}`): recover the dotted
            // lookup so the object-attribute provider can complete the trailing
            // segment. Adopt the recovered node ONLY when it carries a trailing
            // lookup segment. A bracket key recovery cannot represent
            // (`{{ product[01^ }}`, `{{ x[0].^ }}`) breaks before pushing any
            // segment and yields a bare name-only lookup; synthesizing that
            // would let the variable-name provider wrongly complete the object
            // name. Leaving finder.current unchanged keeps those cases
            // returning [].
            const exprStart =
              current.position.start +
              (source.slice(current.position.start, cursor).match(/^\{\{-?\s*/)?.[0].length ?? 0);
            const region = source.slice(exprStart, cursor);
            const openString = unterminatedString(region, exprStart);
            if (region.trim() === '') {
              /*
               * An empty closed output (`{{ ^ }}`): the parser left the markup a
               * raw string with nothing before the caret. Synthesize the blank
               * lookup the object provider completes against, mirroring the
               * unclosed `{{ ^` path. This branch is additive — any non-empty
               * region (including a bracket key like `x[0].`) still flows through
               * the recover+guard below, so that behaviour is unchanged.
               */
              finder.current = synthVariableLookup(cursor);
            } else if (openString && /^\s*['"]/.test(region)) {
              /*
               * A closed output whose expression is a string the caret still
               * sits inside, trailed by an empty filter (`{{ "general.^" | }}`).
               * The malformed `| }}` leaves the markup a raw string and the pipe
               * sits after the caret, so the filter-slot synth sees no pipe and
               * the finder never reaches a parsed LiquidVariable. Synthesize the
               * LiquidVariable -> String subtree the translation provider needs
               * (its guard requires a LiquidVariable parent); the no-filter
               * LiquidVariable arm below then walks down to the String. Mirrors
               * the error-node `{{ "genera` path. `unterminatedString` returns
               * undefined once the quote is closed, so `x[0].`, `"done".`, and
               * empty regions never take this branch.
               */
              finder.current = {
                type: NodeTypes.LiquidVariable,
                expression: synthString(openString, cursor),
                filters: [],
                position: { start: exprStart, end: cursor },
                source,
              } as any as LiquidHtmlNode;
            } else {
              const recovered = recoverVariableLookup(source, exprStart, cursor);
              if (recovered.type === NodeTypes.VariableLookup && recovered.lookups.length > 0) {
                finder.current = recovered;
              }
            }
          }
        }
        break;
      }

      case NodeTypes.LiquidVariable: {
        if (isNotEmpty(current.filters)) {
          // Descend into the filter the caret actually sits in, not blindly the
          // last one: a caret in an earlier filter of a chain
          // (`{{ x | image_url: █ | image_tag }}`) must complete against that
          // filter, not the trailing one. When no filter covers the caret but it
          // still sits within the expression (`{{ 'general.█' | t }}` — the caret
          // is on the string, the pipe is a real `t` filter), complete the
          // expression so translation keys are offered rather than filter names.
          // Otherwise fall back to the last filter, preserving prior behaviour.
          const covered = current.filters.find((filter) => isCovered(cursor, filter.position));
          if (covered) {
            finder.current = covered;
          } else if (current.expression && cursor <= current.expression.position.end) {
            finder.current = current.expression;
          } else {
            finder.current = last(current.filters);
          }
        } else {
          finder.current = current.expression;
        }
        break;
      }

      case NodeTypes.LiquidFilter: {
        if (isNotEmpty(current.args)) {
          // Descend into the argument the caret sits in rather than blindly the
          // last one; a caret in an earlier parameter of a multi-argument
          // filter (`{{ x | image_url: wid█th: 1, crop: 2 }}`) must complete
          // against that parameter. When no argument covers the caret we stay
          // on the filter itself (the filter-name provider completes there).
          const coveredArg = current.args.find((arg) => isCovered(cursor, arg.position));
          if (coveredArg) {
            if (
              coveredArg.type === NodeTypes.NamedArgument &&
              cursor <= coveredArg.position.start + coveredArg.name.length
            ) {
              // The caret is in the parameter NAME. The named-parameter
              // provider completes a top-level `VariableLookup` whose parent is
              // this `LiquidFilter`, so synthesize that lookup here — carrying
              // the typed prefix — instead of descending into the
              // `NamedArgument` (which would leave the argument, not the filter,
              // as the leaf's parent).
              finder.current = {
                type: NodeTypes.VariableLookup,
                name: coveredArg.name.slice(0, cursor - coveredArg.position.start),
                lookups: [],
                position: { start: coveredArg.position.start, end: cursor },
              } as any as LiquidHtmlNode;
            } else {
              finder.current = coveredArg;
            }
          }
        }
        break;
      }

      case NodeTypes.VariableLookup: {
        if (
          hasNonEmptyArrayProperty(current, 'lookups') &&
          last(current.lookups).type === NodeTypes.VariableLookup
        ) {
          finder.current = last(current.lookups);
        }
        break;
      }

      case NodeTypes.AssignMarkup: {
        finder.current = current.value;
        break;
      }

      case NodeTypes.ForMarkup: {
        if (isCovered(cursor, current.collection.position)) {
          finder.current = current.collection;
        } else if (isNotEmpty(current.args) && isCovered(cursor, last(current.args).position)) {
          finder.current = last(current.args);
        } else if (
          current.collection.position.start > cursor &&
          /\bin\s/.test(source.slice(current.position.start, cursor))
        ) {
          /*
           * The parser mis-absorbed an abutting `{% endfor %}` as the loop
           * collection (`{% for x in ^{% endfor %}`): the collection node lives
           * entirely downstream of the caret. The `in ` guard confirms the caret
           * is past the `in` keyword (a real collection slot, not the
           * loop-variable slot), so recover the empty lookup there for the
           * object provider.
           */
          finder.current = recoverVariableLookup(source, current.position.start, cursor);
        }
        break;
      }

      case NodeTypes.NamedArgument: {
        if (isCovered(cursor, current.value.position)) {
          finder.current = current.value;
        }
        break;
      }

      case NodeTypes.Comparison: {
        if (isCovered(cursor, current.right.position)) {
          finder.current = current.right;
        } else if (isCovered(cursor, current.left.position)) {
          finder.current = current.left;
        }
        break;
      }

      case NodeTypes.LogicalExpression: {
        if (isCovered(cursor, current.right.position)) {
          finder.current = current.right;
        } else if (isCovered(cursor, current.left.position)) {
          finder.current = current.left;
        }
        break;
      }

      case NodeTypes.CycleMarkup: {
        if (isNotEmpty(current.args)) {
          finder.current = last(current.args);
        }
        break;
      }

      case NodeTypes.PaginateMarkup: {
        if (isNotEmpty(current.args)) {
          finder.current = last(current.args);
        } else if (isCovered(cursor, current.collection.position)) {
          finder.current = current.collection;
        } else if (isCovered(cursor, current.pageSize.position)) {
          finder.current = current.pageSize;
        }
        break;
      }

      case NodeTypes.ContentForMarkup: {
        const coveredArg = isNotEmpty(current.args)
          ? current.args.find((arg) => isCovered(cursor, arg.position))
          : undefined;
        if (coveredArg) {
          if (
            coveredArg.type === NodeTypes.NamedArgument &&
            cursor <= coveredArg.position.start + coveredArg.name.length
          ) {
            // The caret is in the parameter NAME. The content_for parameter
            // provider completes a top-level `VariableLookup` whose parent is
            // this `ContentForMarkup`, so synthesize that lookup here —
            // carrying the typed prefix — instead of descending into the
            // `NamedArgument` (which would leave the argument, not the markup,
            // as the leaf's parent).
            finder.current = {
              type: NodeTypes.VariableLookup,
              name: coveredArg.name.slice(0, cursor - coveredArg.position.start),
              lookups: [],
              position: { start: coveredArg.position.start, end: cursor },
            } as any as LiquidHtmlNode;
          } else {
            finder.current = coveredArg;
          }
        } else if (isCovered(cursor, current.contentForType.position)) {
          finder.current = current.contentForType;
        } else if (isCovered(cursor, current.position)) {
          // The caret sits in the argument slot after the block name
          // (`{% content_for "b", ^ %}`); the parser recovered the markup but
          // left the slot empty. Synthesize the argument lookup the
          // content_for parameter provider completes against.
          const partial = source
            .slice(current.position.start, cursor)
            .match(/([a-zA-Z_][\w-]*)$/)?.[1];
          finder.current = synthVariableLookup(cursor, partial);
        }

        break;
      }

      // `block` and `section` markup carry a name plus optional named
      // arguments, so we walk them the same way as `content_for`.
      case NodeTypes.BlockMarkup:
      case NodeTypes.SectionMarkup: {
        if (isNotEmpty(current.args)) {
          const arg = last(current.args);
          finder.current = isBlockArrayArgument(arg) ? arg.value.elements.at(-1) : arg;
        } else if (isCovered(cursor, current.name.position)) {
          finder.current = current.name;
        }

        break;
      }

      case NodeTypes.RenderMarkup: {
        if (isNotEmpty(current.args) && isCovered(cursor, last(current.args).position)) {
          finder.current = last(current.args);
        } else if (current.variable && isCovered(cursor, current.variable.position)) {
          finder.current = current.variable;
        } else if (current.snippet && isCovered(cursor, current.snippet.position)) {
          finder.current = current.snippet;
        } else if (isCovered(cursor, current.position)) {
          // The caret sits in the argument slot after the snippet name
          // (`{% render 'snip', ^ %}`); the markup parsed but the slot is
          // empty. Synthesize the argument lookup the render-snippet parameter
          // provider completes against.
          finder.current = synthVariableLookup(cursor);
        }

        break;
      }

      case NodeTypes.RenderVariableExpression: {
        finder.current = current.name;
        break;
      }

      case NodeTypes.Range: {
        if (isCovered(cursor, current.end.position)) {
          finder.current = current.end;
        } else if (isCovered(cursor, current.start.position)) {
          finder.current = current.start;
        }
        break;
      }

      // Once the cursor lands inside a `LiquidErrorNode` the finder alone
      // cannot say what should be completed there; the D3 intent resolver
      // takes over. For now this is a terminal arm (kept out of `assertNever`
      // for type-exhaustiveness) and the fallback below maps it to
      // `undefined` plus the error node's ancestry.
      case NodeTypes.LiquidErrorNode: {
        break;
      }

      // If you end up on any of these. You're done.
      // That's the current node.
      case NodeTypes.TextNode:
      case NodeTypes.LiquidLiteral:
      case NodeTypes.BooleanExpression:
      case NodeTypes.String:
      case NodeTypes.Number:
      case NodeTypes.LiquidDocParamNode:
      case NodeTypes.LiquidDocExampleNode:
      case NodeTypes.LiquidDocDescriptionNode:
      case NodeTypes.LiquidDocPromptNode:
      case NodeTypes.RenderAliasExpression: {
        break;
      }

      default: {
        return assertNever(current);
      }
    }
  }

  /*
   * Error-node fallback: the D3 intent resolver. When the deepest covering
   * node is a `LiquidErrorNode`, the finder alone cannot say what to complete,
   * so we reconstruct the intent from the error node and hand it to the
   * resolver, which synthesizes the typed node the providers expect.
   */
  if (finder.current?.type === NodeTypes.LiquidErrorNode) {
    const match = findErrorNodeAtOffset(partialAst, cursor);
    const errorNode = match ? match.node : finder.current;
    const ancestors = match ? match.ancestors : finder.stack.slice(0, -1).filter(isDefined);
    const resolved = resolveErrorNodeCompletion(errorNode, ancestors, cursor, source);
    if (resolved[0] !== undefined) return resolved;

    /*
     * The frozen resolver could not classify this error node. Fall through to
     * the HTML tag-name / attr-name / dangling-close recovery (D5). Its arms
     * only match `<`-constructs, so a non-HTML error node still yields the
     * frozen resolver's `[undefined, ancestors]`.
     */
    return resolveHtmlErrorNodeCompletion(errorNode, ancestors, cursor, source) ?? resolved;
  }

  const node = finder.stack.pop()!;
  const ancestors = finder.stack as NonEmptyArray<LiquidHtmlNode>;

  // The descent bottomed out without a node (e.g. a dangling `{% e^` inside an
  // open block), but the caret may still sit on an unclosed tag name. Recover
  // the tag carrying the typed partial so the provider can offer tag names
  // (and, via the accumulated ancestry, the matching `end` tag).
  if (node === undefined) {
    const recovered = synthTagNameNode(source, cursor);
    if (recovered) {
      return [recovered, ancestors];
    }

    // Inside an open `{% liquid %}` block each newline begins a new inner tag,
    // so a caret on a body line completes an inner tag even though the descent
    // found no `LiquidTag` there. Recover it from the current line; the
    // ancestry already carries the enclosing `{% liquid %}` tag.
    const innerTag = recoverLiquidInnerTag(source, cursor, ancestors);
    if (innerTag) {
      return innerTag;
    }
  }

  return [node, ancestors];
}

/*
 * The D3 intent resolver. When the cursor lands inside a `LiquidErrorNode` the
 * finder cannot say what to complete, so we reconstruct the intent from the
 * error node plus a bounded backward scan of the source and synthesize the
 * typed node the providers expect (with an ancestry that satisfies their
 * `ancestors.at(-1)` guards).
 *
 * This narrowed resolver covers the error-node-reachable positions: the
 * `{% doc %}` tag handles, and the unterminated-string positions of
 * `{% render %}` (snippet names) and `{{ ... }}` output (translation keys).
 * Anything it cannot classify keeps the previous behaviour — no completion,
 * but the error node's ancestry is preserved. The closed empty-slot
 * (string-markup) positions carry no error node and are handled in D3b.
 */
function resolveErrorNodeCompletion(
  errorNode: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[],
  cursor: number,
  source: string,
): [node: LiquidHtmlNode | undefined, ancestry: LiquidHtmlNode[]] {
  const start = errorNode.position?.start ?? 0;
  const construct = source.slice(start, cursor);

  const docOpen = construct.match(/^\s*\{%-?\s*doc\s*-?%\}/);
  if (docOpen) {
    return resolveLiquidDocCompletion(start + docOpen[0].length, ancestors, cursor, source);
  }

  // Output context: an unclosed `{{` sits before the caret. The bounded scan
  // (rather than a `/^\s*\{\{/` anchor) also catches the HTML-embedded forms
  // whose construct starts with the surrounding tag (`<a data="{{ ^`).
  const open = construct.lastIndexOf('{{');
  if (open !== -1 && construct.indexOf('}}', open) === -1) {
    // A quote immediately after `{{` is an unterminated translation-key string
    // (`{{ "genera`); keep the String arm so translation completion fires.
    if (/^\{\{-?\s*['"]/.test(construct.slice(open))) {
      const openString = unterminatedString(construct, start);
      if (openString) {
        return [
          synthString(openString, cursor),
          [...ancestors, synthNode(NodeTypes.LiquidVariable, cursor)],
        ];
      }
    }

    // A pipe in the unclosed output means the caret sits in a filter or
    // filter-argument slot (`{{ x | ^`, `{{ x | image_url: ^`,
    // `{{ x | image_url: w: 1, ^`). Synthesize the LiquidVariable -> filter ->
    // argument subtree the filter providers complete against. Returns undefined
    // for a non-filter slot (no pipe, or a trailing value/string slot), leaving
    // the bare-lookup recovery below intact.
    const filterSlot = synthUnclosedOutputFilter(source, start + open + 2, cursor, ancestors);
    if (filterSlot) {
      return filterSlot;
    }

    // Otherwise the caret sits in an empty or dotted variable lookup
    // (`{{ ^`, `{{ a^`, `{{ a.^`, `{{ a['^`, `{{ a.b.^`): recover the lookup
    // carrying the name/lookups typed after `{{` so the providers can filter on
    // it, rather than the blank placeholder. `open + 2` skips the `{{` so the
    // back-scan starts inside the output.
    return [
      recoverVariableLookup(source, start + open + 2, cursor),
      [...ancestors, synthNode(NodeTypes.LiquidVariable, cursor)],
    ];
  }

  // `{% render "product` — an unterminated string offers snippet names.
  const openString = unterminatedString(construct, start);
  if (openString && /^\s*\{%-?\s*render\b/.test(construct)) {
    return [
      synthString(openString, cursor),
      [...ancestors, synthNode(NodeTypes.RenderMarkup, cursor)],
    ];
  }

  // An unclosed tag open (`{% comm^`, `{% ^`, `{%- if^`) parses as an error
  // node rather than a `LiquidTag`. Recover the tag carrying the typed partial
  // so tag-name completion still fires when the caret is on the name. When the
  // caret's tag is preceded by an unclosed raw tag (`{% comment %}…{% e^`), we
  // also recover the raw tag into the ancestry so the provider can offer its
  // matching `end` tag.
  const recovered = synthTagNameNode(source, cursor);
  if (recovered) {
    return [recovered, synthRawTagAncestry(source, cursor, ancestors)];
  }

  // An unclosed `{% liquid %}` block collapses to a single error node, so a
  // caret on one of its body lines lands here. Recover the inner tag from the
  // current line, appending the covering `{% liquid %}` tag the error-node
  // ancestry does not carry.
  const innerTag = recoverLiquidInnerTag(source, cursor, ancestors);
  if (innerTag) {
    return innerTag;
  }

  // An unclosed tag whose caret sits PAST the tag name in an expression slot
  // (`{% if ^`, `{% for x in ^`, `{% assign x = ^`, `{% echo ^`, with no `%}`)
  // parses as a bare error node, so no `LiquidTag` finder arm ever runs.
  // Recover the lookup that slot expects. This runs only after the caret-on-name
  // (`synthTagNameNode`) and `{% liquid %}` body (`recoverLiquidInnerTag`)
  // recoveries above have declined, so those keep completing tag / inner-tag
  // names. The `\s` after the tag name keeps caret-on-name cases out;
  // `recoverVariableLookup`'s back-scan isolates the trailing token past `=` /
  // `in` / operators.
  const tagOpen = source.lastIndexOf('{%', cursor);
  if (tagOpen !== -1) {
    const close = source.indexOf('%}', tagOpen);
    const region = source.slice(tagOpen, cursor);
    const nameMatch = region.match(/^\{%-?\s*[a-zA-Z_]\w*/);
    if ((close === -1 || close >= cursor) && nameMatch && /\s/.test(region[nameMatch[0].length])) {
      const lowerBound = tagOpen + nameMatch[0].length;
      return [
        recoverVariableLookup(source, lowerBound, cursor),
        [...ancestors, synthNode(NodeTypes.LiquidTag, cursor)],
      ];
    }
  }

  // A caret inside an unclosed HTML tag's attribute value (`<img loading="^`,
  // `<a href="ba^`) parses to a bare error node, so the `AttrDoubleQuoted` /
  // `AttrSingleQuoted` finder arm is never reached — the tag never closes.
  // Fabricate the `TextNode` + attribute/element ancestry the
  // HtmlAttributeValue provider's guards expect.
  const attrValue = resolveHtmlAttrValueCompletion(construct, ancestors, cursor);
  if (attrValue) {
    return attrValue;
  }

  return [undefined, ancestors];
}

/*
 * Regime A HTML recovery. When the frozen `resolveErrorNodeCompletion` cannot
 * classify an error node, the caret may still sit inside an unclosed HTML tag
 * that collapsed to a bare error node: a tag name (`<h`), an attribute-name
 * slot (`<a `, `<a {% if cond %}`), or a dangling close (`<h1></h`). Rebuild the
 * tag-name / attr-name / dangling-close ancestry the HtmlTag and HtmlAttribute
 * providers expect. Each arm anchors on a `<`-construct, so a non-HTML error
 * node matches nothing and returns undefined, leaving the frozen resolver's
 * `[undefined, ancestors]` in place.
 */
function resolveHtmlErrorNodeCompletion(
  errorNode: LiquidHtmlNode,
  ancestors: LiquidHtmlNode[],
  cursor: number,
  source: string,
): [node: LiquidHtmlNode, ancestry: LiquidHtmlNode[]] | undefined {
  const start = errorNode.position?.start ?? 0;
  const construct = source.slice(start, cursor);

  // Arm 1 — dangling close (`<h1></h`): a `</` close-open runs through the
  // caret. The close-tag name scan is bounded to the nearest tag opener and
  // closer around the caret, so malformed trailing attributes
  // (`</a^ href="...">`) do not hide the tag-name context.
  const closeTagName = htmlCloseTagNameAtCursor(source, cursor);
  if (closeTagName) {
    const { partial, partialStart, tagOpen } = closeTagName;
    const openName = matchingOpenTagName(source.slice(start, tagOpen));
    if (!openName) {
      const leaf = {
        type: NodeTypes.TextNode,
        value: partial,
        position: { start: partialStart, end: cursor },
      } as any as LiquidHtmlNode;
      const danglingClose = {
        type: NodeTypes.HtmlDanglingMarkerClose,
        name: [leaf],
        position: { start: partialStart, end: cursor },
      } as any as LiquidHtmlNode;
      return [leaf, [...ancestors, danglingClose]];
    }

    if (!openName || !openName.startsWith(partial) || openName === partial) {
      return undefined;
    }

    const leaf = {
      type: NodeTypes.TextNode,
      value: partial,
      position: { start: partialStart, end: cursor },
    } as any as LiquidHtmlNode;
    const danglingClose = {
      type: NodeTypes.HtmlDanglingMarkerClose,
      name: [leaf],
      position: { start: partialStart, end: cursor },
    } as any as LiquidHtmlNode;
    const element = {
      type: NodeTypes.HtmlElement,
      name: [
        {
          type: NodeTypes.TextNode,
          value: openName,
          position: { start, end: start },
        },
      ],
      attributes: [],
      children: [],
      position: { start, end: cursor },
    } as any as LiquidHtmlNode;
    return [leaf, [...ancestors, element, danglingClose]];
  }

  // Arm 2 — attribute-name slot (`<a `, `<unknown `, `<a {% if cond %}`): a tag
  // name followed by a boundary (whitespace and/or embedded liquid), with no
  // `>` before the caret. The partial anchors on a trailing identifier, so a
  // caret after a space or a `%}` yields an empty partial (the full attr list).
  const attrOpen = construct.match(/^<([a-zA-Z][\w:-]*)\s/);
  if (attrOpen && construct.indexOf('>') === -1) {
    const tagName = attrOpen[1];
    const partial = construct.match(/[a-zA-Z_:][\w:.-]*$/)?.[0] ?? '';
    const partialStart = cursor - partial.length;
    const leaf = {
      type: NodeTypes.TextNode,
      value: partial,
      position: { start: partialStart, end: cursor },
    } as any as LiquidHtmlNode;
    const attrEmpty = {
      type: NodeTypes.AttrEmpty,
      name: [leaf],
      position: { start: partialStart, end: cursor },
    } as any as LiquidHtmlNode;
    const element = {
      type: NodeTypes.HtmlElement,
      name: [
        {
          type: NodeTypes.TextNode,
          value: tagName,
          position: { start: start + 1, end: start + 1 + tagName.length },
        },
      ],
      attributes: [attrEmpty],
      children: [],
      position: { start, end: cursor },
    } as any as LiquidHtmlNode;
    return [leaf, [...ancestors, element, attrEmpty]];
  }

  // Arm 3 — tag name (`<h`, `<img`): the tag name runs to the caret with no
  // boundary and no `>`. Offer the tag names starting with the typed partial.
  const tagOpen = construct.match(/^<([a-zA-Z][\w:-]*)$/);
  if (tagOpen) {
    const tagName = tagOpen[1];
    if (VOID_ELEMENTS.includes(tagName.toLowerCase())) {
      const blockStartPosition = { start, end: cursor };
      const element = {
        type: NodeTypes.HtmlVoidElement,
        name: tagName,
        attributes: [],
        blockStartPosition,
        position: blockStartPosition,
        source,
      } as any as LiquidHtmlNode;
      return [element, ancestors];
    }

    const leaf = {
      type: NodeTypes.TextNode,
      value: tagName,
      position: { start: start + 1, end: cursor },
    } as any as LiquidHtmlNode;
    const element = {
      type: NodeTypes.HtmlElement,
      name: [leaf],
      attributes: [],
      children: [],
      position: { start, end: cursor },
    } as any as LiquidHtmlNode;
    return [leaf, [...ancestors, element]];
  }

  return undefined;
}

/*
 * Returns the close-tag name fragment ending at the caret, bounded by the
 * nearest `<` before the cursor and the nearest `>` after it. That keeps the
 * recovery local to the tag-name slot while still accepting malformed close
 * tags with source after the caret (`</a^ href="...">`).
 */
function htmlCloseTagNameAtCursor(
  source: string,
  cursor: number,
): { tagOpen: number; partialStart: number; partial: string } | undefined {
  const tagOpen = source.lastIndexOf('<', cursor - 1);
  if (tagOpen === -1 || source[tagOpen + 1] !== '/') return undefined;

  const previousClose = source.lastIndexOf('>', cursor - 1);
  if (previousClose > tagOpen) return undefined;

  const nextClose = source.indexOf('>', cursor);
  const nextOpen = source.indexOf('<', cursor);
  if (nextOpen !== -1 && (nextClose === -1 || nextOpen < nextClose)) return undefined;

  const prefix = source.slice(tagOpen, cursor);
  const match = prefix.match(/^<\/([a-zA-Z][\w:-]*)?$/);
  if (!match) return undefined;

  const partial = match[1] ?? '';
  return {
    tagOpen,
    partialStart: cursor - partial.length,
    partial,
  };
}

/*
 * Scans an HTML construct left-to-right for the innermost unclosed open tag,
 * maintaining a stack of open-tag names: `<name` pushes, a `</name` close-open
 * pops the nearest matching open. The name left on top is the one a trailing
 * `</` would close. The shipped cases are flat (`<h1>` -> `['h1']`), so deeper
 * nesting is best-effort (innermost-unclosed wins).
 */
function matchingOpenTagName(region: string): string | undefined {
  const stack: string[] = [];
  const tagPattern = /<(\/?)([a-zA-Z][\w:-]*)/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(region))) {
    const [, slash, name] = match;
    if (slash) {
      const openIndex = stack.lastIndexOf(name);
      if (openIndex !== -1) stack.splice(openIndex);
    } else {
      stack.push(name);
    }
  }
  return stack.length > 0 ? stack[stack.length - 1] : undefined;
}

/*
 * Inside an unclosed `{% doc %}` tag we synthesize a `TextNode` holding the
 * text of the current line (leading whitespace stripped), which is what the
 * LiquidDoc providers read to classify an `@`-handle or an `@param {type}`.
 * The synthesized parent is the enclosing `doc` raw tag their guards expect.
 */
function resolveLiquidDocCompletion(
  contentStart: number,
  ancestors: LiquidHtmlNode[],
  cursor: number,
  source: string,
): [node: LiquidHtmlNode, ancestry: LiquidHtmlNode[]] {
  const lineStart = Math.max(contentStart, source.lastIndexOf('\n', cursor - 1) + 1);
  const value = source.slice(lineStart, cursor).replace(/^\s+/, '');
  const textNode = {
    type: NodeTypes.TextNode,
    value,
    position: { start: cursor, end: cursor },
  } as any as LiquidHtmlNode;
  const docTag = {
    type: NodeTypes.LiquidRawTag,
    name: 'doc',
    position: { start: contentStart, end: cursor },
  } as any as LiquidHtmlNode;
  return [textNode, [...ancestors, docTag]];
}

/*
 * Scans `text` (a construct's source from its start up to the caret) and, if
 * the caret sits inside an unterminated string literal, returns that string's
 * absolute start offset, its content so far, and whether it is single-quoted.
 */
function unterminatedString(
  text: string,
  offset: number,
): { start: number; value: string; single: boolean } | undefined {
  let quote: "'" | '"' | undefined;
  let startIndex = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote) {
        quote = undefined;
        startIndex = -1;
      }
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      startIndex = i;
    }
  }

  if (!quote) return undefined;
  return {
    start: offset + startIndex,
    value: text.slice(startIndex + 1),
    single: quote === "'",
  };
}

/*
 * Scans `construct` (an error node's source up to the caret) for a caret
 * sitting inside an unclosed HTML tag's quoted attribute value. Returns the
 * tag name, attribute name, the value typed so far, and the quote style, or
 * `undefined` when the caret is not in that position.
 */
function unterminatedAttrValue(
  construct: string,
): { tagName: string; attrName: string; value: string; single: boolean } | undefined {
  const tagOpen = construct.lastIndexOf('<');
  if (tagOpen === -1 || construct.indexOf('>', tagOpen) !== -1) return undefined;

  const tagStr = construct.slice(tagOpen);
  const tagName = tagStr.match(/^<([a-zA-Z][\w:-]*)/);
  if (!tagName) return undefined;

  // A trailing `attr="value` (or single-quoted) with no closing quote before
  // the caret. The value run stops at the quote char, so anchoring to the end
  // guarantees the matched quote is the one still open at the caret.
  const attr = tagStr.match(/([a-zA-Z_:][\w:.-]*)\s*=\s*(["'])((?:(?!\2).)*)$/);
  if (!attr) return undefined;

  return {
    tagName: tagName[1],
    attrName: attr[1],
    value: attr[3],
    single: attr[2] === "'",
  };
}

/*
 * Reconstructs the HTML attribute-value context lost when an unclosed tag
 * collapses to a bare error node. The value typed so far becomes a `TextNode`;
 * it is wrapped in a synthesized `AttrDoubleQuoted` / `AttrSingleQuoted` whose
 * `value` holds that same node (the provider's `value.includes(node)` is an
 * identity check) and a named `HtmlElement` parent so `getCompoundName`
 * resolves the tag name. Ancestry is root-first, so the element then the
 * attribute are appended last for the provider's leaf-ward `findLast`.
 */
function resolveHtmlAttrValueCompletion(
  construct: string,
  ancestors: LiquidHtmlNode[],
  cursor: number,
): [node: LiquidHtmlNode, ancestry: LiquidHtmlNode[]] | undefined {
  const attr = unterminatedAttrValue(construct);
  if (!attr) return undefined;

  const valueStart = cursor - attr.value.length;
  const textNode = {
    type: NodeTypes.TextNode,
    value: attr.value,
    position: { start: valueStart, end: cursor },
  } as any as LiquidHtmlNode;

  const attributeNode = {
    type: attr.single ? NodeTypes.AttrSingleQuoted : NodeTypes.AttrDoubleQuoted,
    name: [
      {
        type: NodeTypes.TextNode,
        value: attr.attrName,
        position: { start: valueStart, end: valueStart },
      },
    ],
    value: [textNode],
    attributePosition: { start: valueStart, end: cursor },
    position: { start: valueStart, end: cursor },
  } as any as LiquidHtmlNode;

  const tagNode = {
    type: NodeTypes.HtmlElement,
    name: [
      {
        type: NodeTypes.TextNode,
        value: attr.tagName,
        position: { start: valueStart, end: valueStart },
      },
    ],
    attributes: [attributeNode],
    children: [],
    position: { start: valueStart, end: cursor },
  } as any as LiquidHtmlNode;

  return [textNode, [...ancestors, tagNode, attributeNode]];
}

/*
 * Synthesizes a `String` node spanning from the opening quote to the caret,
 * carrying the text typed so far. Read by the render-snippet and translation
 * providers via `node.value`.
 */
function synthString(
  str: { start: number; value: string; single: boolean },
  cursor: number,
): LiquidHtmlNode {
  return {
    type: NodeTypes.String,
    value: str.value,
    single: str.single,
    position: { start: str.start, end: cursor },
  } as any as LiquidHtmlNode;
}

/*
 * A minimal typed node used purely to carry `type` so a provider's
 * `ancestors.at(-1)` guard resolves. Positioned at the caret.
 */
function synthNode(type: NodeTypes, cursor: number): LiquidHtmlNode {
  return {
    type,
    position: { start: cursor, end: cursor },
  } as any as LiquidHtmlNode;
}

/*
 * Synthesizes the empty `VariableLookup` an unfinished expression slot expects
 * (`{{ ^`, `{% echo ^ %}`, `{% if a > ^ %}`). It carries no name and no
 * lookups; that is enough for the completion machinery, which keys off the
 * node's `type`. Positioned at the caret.
 */
function synthVariableLookup(cursor: number, name = ''): LiquidHtmlNode {
  return {
    type: NodeTypes.VariableLookup,
    name,
    lookups: [],
    position: { start: cursor - name.length, end: cursor },
  } as any as LiquidHtmlNode;
}

/*
 * Recovers the variable lookup the caret is completing and builds a real
 * `VariableLookup` carrying the name and lookups typed so far — the shape the
 * object providers read — instead of the blank placeholder. Used where the
 * parser leaves the expression unrecovered: an unclosed `{{` output (a document
 * error node) and a tag whose markup stayed a raw string (`{% echo a.b.^ %}`).
 *
 * `lowerBound` is the earliest offset the lookup can start at (just past the
 * `{{`, or the tag's `{%`), so the back-scan never reaches into the surrounding
 * markup. From the caret we walk back over the lookup token — identifier chars,
 * `.`, and bracket/quote chars — then split it into a leading name plus its
 * `.prop` / `['key']` segments. A trailing `.` or `[` leaves an empty final
 * segment, which is exactly the "typing the next property" placeholder the
 * attribute provider offers against. When nothing has been typed (an empty
 * slot: `{{ ^`, `{% echo ^ %}`) we fall back to the blank lookup, preserving
 * the placeholder behaviour.
 */
function recoverVariableLookup(source: string, lowerBound: number, cursor: number): LiquidHtmlNode {
  let start = cursor;
  while (start > lowerBound && /[\w.\-\[\]'"]/.test(source[start - 1])) {
    start -= 1;
  }

  const token = source.slice(start, cursor);
  const nameMatch = token.match(/^[a-zA-Z_][\w-]*/);
  if (!nameMatch) return synthVariableLookup(cursor);

  const name = nameMatch[0];
  const lookups: LiquidHtmlNode[] = [];
  let i = name.length;
  while (i < token.length) {
    const ch = token[i];
    if (ch === '.') {
      // A `.prop` segment. A trailing `.` matches no identifier, so `seg` is the
      // empty-valued placeholder the attribute provider completes against.
      i += 1;
      const seg = (token.slice(i).match(/^[a-zA-Z_][\w-]*/) ?? [''])[0];
      const segStart = start + i;
      lookups.push(synthStringLookup(seg, false, segStart, segStart + seg.length));
      i += seg.length;
    } else if (ch === '[') {
      // A `['key']` / `["key"]` segment, possibly still unclosed (`a['b`). The
      // bracket routes to a lookup (never a string); we carry the key so far.
      i += 1;
      const quote = token[i];
      if (quote === "'" || quote === '"') {
        i += 1;
        const seg = (token.slice(i).match(quote === "'" ? /^[^']*/ : /^[^"]*/) ?? [''])[0];
        const segStart = start + i;
        lookups.push(synthStringLookup(seg, quote === "'", segStart, segStart + seg.length));
        i += seg.length;
        if (token[i] === quote) i += 1;
        if (token[i] === ']') i += 1;
      } else {
        const segmentStart = start + i;
        const segment = (token.slice(i).match(/^(?:[a-zA-Z_][\w-]*|\d+)/) ?? [''])[0];
        if (segment === 'true' || segment === 'false') break;
        if (!segment || token[i + segment.length] !== ']') break;
        lookups.push(synthBracketLookup(segment, segmentStart, segmentStart + segment.length));
        i += segment.length + 1;
      }
    } else {
      break;
    }
  }

  return {
    type: NodeTypes.VariableLookup,
    name,
    lookups,
    position: { start, end: cursor },
  } as any as LiquidHtmlNode;
}

/*
 * Recovers the pre-pipe expression of a filter slot as a typed node so the
 * filter provider can narrow completions by input type. A string / number /
 * range literal becomes the matching literal node — `inferType` keys off `type`
 * alone, so a `String` narrows to `'string'`, a `Number` to `'number'`, and a
 * `Range` to an array. That makes `{{ "1" | ^ }}` offer string filters and
 * `{{ (1..3) | ^ }}` offer array filters. Anything else (an identifier or dotted
 * lookup) falls back to `recoverVariableLookup`, so non-literal expressions keep
 * their previous behaviour.
 */
function recoverExpression(source: string, start: number, end: number): LiquidHtmlNode {
  const token = source.slice(start, end).trim();

  if (/^(['"])[\s\S]*\1$/.test(token)) {
    return {
      type: NodeTypes.String,
      value: token.slice(1, -1),
      single: token[0] === "'",
      position: { start, end },
    } as any as LiquidHtmlNode;
  }

  if (/^-?\d+(\.\d+)?$/.test(token)) {
    return {
      type: NodeTypes.Number,
      value: token,
      position: { start, end },
    } as any as LiquidHtmlNode;
  }

  if (/^\(.*\.\..*\)$/.test(token)) {
    return {
      type: NodeTypes.Range,
      position: { start, end },
    } as any as LiquidHtmlNode;
  }

  return recoverVariableLookup(source, start, end);
}

/*
 * A `String` lookup segment (`.prop` / `['key']`) carrying the property name
 * typed so far, mirroring the `String` nodes the parser puts in a
 * `VariableLookup`'s `lookups`. The attribute provider keys off `value` and
 * `type` to resolve and offer the next property.
 */
function synthStringLookup(
  value: string,
  single: boolean,
  start: number,
  end: number,
): LiquidHtmlNode {
  return {
    type: NodeTypes.String,
    value,
    single,
    position: { start, end },
  } as any as LiquidHtmlNode;
}

function synthBracketLookup(value: string, start: number, end: number): LiquidHtmlNode {
  if (/^\d+$/.test(value)) {
    return {
      type: NodeTypes.Number,
      value,
      position: { start, end },
    } as any as LiquidHtmlNode;
  }

  return {
    type: NodeTypes.VariableLookup,
    name: value,
    lookups: [],
    position: { start, end },
  } as any as LiquidHtmlNode;
}

/*
 * Recovers the `LiquidTag` the caret sits on when the tag is unclosed and the
 * caret is still on the name (`{% comm^`, `{% ^`, `{%- if^`, `{% for^ ...`).
 * The parser leaves these as error nodes, so we synthesize the tag carrying the
 * typed name as `name` (with a span from `{%` to the caret) — the shape
 * `completionPartial` and the tag providers read.
 *
 * The anchored `$` on the name match is the "caret on the name" guard: it holds
 * only while nothing but the name has been typed after `{%`, so expression-slot
 * carets (`{% for i in (1..3)^`) fall through to no completion.
 */
function synthTagNameNode(source: string, cursor: number): LiquidHtmlNode | undefined {
  const open = source.lastIndexOf('{%', cursor);
  if (open === -1) return undefined;

  // The tag must be unclosed up to the caret; a `%}` before the caret means we
  // are past the tag start and should not recover a name.
  const close = source.indexOf('%}', open);
  if (close !== -1 && close < cursor) return undefined;

  const construct = source.slice(open, cursor);
  const match = construct.match(/^\{%(-?)\s*([a-zA-Z_][\w-]*)?$/);
  if (!match) return undefined;

  return {
    type: NodeTypes.LiquidTag,
    name: match[2] ?? '',
    markup: '',
    whitespaceStart: match[1],
    whitespaceEnd: '',
    position: { start: open, end: cursor },
    blockStartPosition: { start: open, end: cursor },
  } as any as LiquidHtmlNode;
}

/*
 * When the caret sits on a bare `{% end^`/`{% e^`/`{% ^` tag whose enclosing
 * raw tag (`{% comment %}`, `{% javascript %}`, …) was never closed, the
 * resilient parser emits sibling `LiquidErrorNode`s rather than a raw
 * `LiquidTag`, so the provider's raw-tag branch has no sibling to key its
 * `end<name>` on. We detect the unclosed raw opener from the source before the
 * caret's `{%` and synthesize the raw `LiquidTag` into a parent whose children
 * carry it — the shape the provider's raw-tag branch expects — so `endcomment`
 * / `endjavascript` are offered. When there is no unclosed raw opener the
 * ancestry is returned unchanged.
 */
function synthRawTagAncestry(
  source: string,
  cursor: number,
  ancestors: LiquidHtmlNode[],
): LiquidHtmlNode[] {
  const open = source.lastIndexOf('{%', cursor);
  if (open === -1) return ancestors;

  const opener = lastUnclosedRawTag(source.slice(0, open));
  if (!opener) return ancestors;

  const rawTag = {
    type: NodeTypes.LiquidTag,
    name: opener.name,
    markup: '',
    position: { start: opener.start, end: open },
    blockStartPosition: { start: opener.start, end: opener.end },
  } as any as LiquidHtmlNode;

  const parent = {
    type: NodeTypes.Document,
    children: [rawTag],
    position: { start: opener.start, end: cursor },
  } as any as LiquidHtmlNode;

  return [...ancestors, parent];
}

/*
 * Scans `text` (source from the document start up to the caret's `{%`) for the
 * last raw-tag opener that has no matching `{% end<name> %}` after it. Returns
 * that opener's name and span, or undefined when every raw tag is closed. Tag
 * openers inside a raw body (e.g. `{% if %}` printed in a `{% comment %}`) are
 * neither raw openers nor the current opener's end tag, so they are ignored.
 */
function lastUnclosedRawTag(
  text: string,
): { name: string; start: number; end: number } | undefined {
  const re = /\{%-?\s*(\w+)\s*-?%\}/g;
  let match: RegExpExecArray | null;
  let found: { name: string; start: number; end: number } | undefined;
  while ((match = re.exec(text)) !== null) {
    const name = match[1];
    if (RAW_TAGS.includes(name)) {
      found = { name, start: match.index, end: re.lastIndex };
    } else if (found && name === `end${found.name}`) {
      found = undefined;
    }
  }
  return found;
}

/*
 * Inside a `{% liquid %}` block the body carries no per-line `{% %}`
 * delimiters: each newline begins a new inner tag. When the caret sits on such
 * a body line the parser leaves no `LiquidTag` there to complete — an unclosed
 * block collapses to a single `LiquidErrorNode`, and a closed block bottoms the
 * descent out on a covering node. Either way we synthesize the inner
 * `LiquidTag` carrying the identifier typed on the current line so the tag
 * provider offers inner tag names in liquid-tag form.
 *
 * When the incoming ancestry does not already carry the enclosing
 * `{% liquid %}` tag we append it. That both marks the liquid-tag context (so
 * the snippet drops its `{%`/`%}`) and makes the liquid block the parent, which
 * suppresses the `end*` offering the block's own grammar forbids.
 *
 * Returns undefined when the caret is not on a liquid body line — no enclosing
 * open block, the opener line itself, or an expression slot rather than a tag
 * name — leaving the previous no-completion behaviour intact.
 */
function recoverLiquidInnerTag(
  source: string,
  cursor: number,
  ancestors: LiquidHtmlNode[],
): [node: LiquidHtmlNode, ancestry: LiquidHtmlNode[]] | undefined {
  const block = enclosingLiquidBlock(source, cursor);
  if (!block) return undefined;

  const lineStart = source.lastIndexOf('\n', cursor - 1) + 1;
  // The opener line (`{% liquid`) is the tag name itself, not a body line.
  if (lineStart <= block.bodyStart) return undefined;

  const leading = source.slice(lineStart, cursor).match(/^\s*/)![0].length;
  const nameStart = lineStart + leading;
  const typed = source.slice(nameStart, cursor);

  // A name followed by whitespace is an expression slot on the body line
  // (`echo ^`, `assign x = ^`, `if a > ^`), not a tag-name position. Recover the
  // lookup that slot expects instead of a tag-name node. `recoverVariableLookup`
  // back-scans the trailing token past `=` / operators; an empty slot yields the
  // blank lookup so the object provider fires.
  if (/^[a-zA-Z_][\w-]*\s+/.test(typed)) {
    const innerName = typed.match(/^[a-zA-Z_][\w-]*/)![0];
    const nameEnd = nameStart + innerName.length;
    const ancestry = ancestors.some(isLiquidLiquidTag)
      ? ancestors
      : [...ancestors, block.liquidTag];

    /*
     * A pipe in the inner statement means the caret sits in a filter or
     * filter-argument slot (`echo x | ^`, `assign v = x | ^`), not an object
     * slot. Delegate to the shared tag filter-slot synth (which narrows by the
     * pre-pipe expression's type) and descend to the completion leaf ourselves,
     * since this recovery returns the final pair rather than re-entering the
     * finder loop. Mirrors the top-level tag filter path.
     */
    if (source.slice(nameStart, cursor).includes('|')) {
      const innerNode = {
        name: innerName,
        position: { start: nameStart, end: cursor },
      } as any as LiquidHtmlNode;
      const variable = synthTagFilterSlot(innerNode, cursor, source);
      if (variable) {
        // `synthFilterSlot` always appends the trailing filter, so `filters` is
        // non-empty by construction; cast so `last` accepts it.
        const filters = (variable as any).filters as NonEmptyArray<LiquidHtmlNode>;
        const filter = last(filters);
        return isNotEmpty((filter as any).args)
          ? [last((filter as any).args), [...ancestry, variable, filter]]
          : [filter, [...ancestry, variable]];
      }
    }

    return [recoverVariableLookup(source, nameEnd, cursor), ancestry];
  }

  // Recover only while the caret is on the inner tag name (or an empty line);
  // an expression slot (`echo `, `if a > `) is not a tag-name position.
  if (typed !== '' && !/^[a-zA-Z_][\w-]*$/.test(typed)) return undefined;

  const node = {
    type: NodeTypes.LiquidTag,
    name: typed,
    markup: '',
    whitespaceStart: '',
    whitespaceEnd: '',
    position: { start: nameStart, end: cursor },
    blockStartPosition: { start: nameStart, end: cursor },
  } as any as LiquidHtmlNode;

  const ancestry = ancestors.some(isLiquidLiquidTag) ? ancestors : [...ancestors, block.liquidTag];

  return [node, ancestry];
}

/*
 * Finds the `{% liquid %}` block enclosing the caret and returns the offset
 * just past its `liquid` opener plus a synthesized covering `LiquidTag#liquid`.
 * The block encloses the caret when the nearest `{% liquid` before it has no
 * closing `%}` before the caret — an unclosed block never closes, a closed one
 * closes after the caret. Returns undefined otherwise.
 */
function enclosingLiquidBlock(
  source: string,
  cursor: number,
): { bodyStart: number; liquidTag: LiquidHtmlNode } | undefined {
  const re = /\{%-?\s*liquid\b/g;
  let match: RegExpExecArray | null;
  let opener: RegExpExecArray | undefined;
  while ((match = re.exec(source)) !== null && match.index < cursor) {
    opener = match;
  }
  if (!opener) return undefined;

  const openStart = opener.index;
  const bodyStart = openStart + opener[0].length;
  const close = source.indexOf('%}', bodyStart);
  if (close !== -1 && close < cursor) return undefined;

  const liquidTag = {
    type: NodeTypes.LiquidTag,
    name: 'liquid',
    markup: '',
    position: { start: openStart, end: close === -1 ? cursor : close + 2 },
    blockStartPosition: { start: openStart, end: bodyStart },
  } as any as LiquidHtmlNode;

  return { bodyStart, liquidTag };
}

/*
 * For a tag, branch, or output whose markup the parser left as a raw string,
 * the expression slot at the caret is empty or unfinished. We synthesize the
 * node that slot expects: the snippet-name slot of `render`/`content_for` wants
 * a `String` (snippet names are offered there), while every other slot wants a
 * `VariableLookup`.
 */
function synthMarkupSlot(node: any, cursor: number, source: string): LiquidHtmlNode {
  const name = node?.name;
  if (name === 'render' || name === 'content_for') {
    const afterName = source.slice(node.position.start, cursor).replace(/^\{%-?\s*\S+\s*/, '');
    if (afterName.trim() === '') {
      return synthString({ start: cursor, value: '', single: false }, cursor);
    }
  }
  // Every other slot wants a `VariableLookup`. The parser only leaves markup as
  // a raw string when the expression is unfinished, so a dotted lookup with a
  // trailing `.` (`{% echo product.metafields.^ %}`) lands here — recover the
  // name/lookups typed so far so the attribute provider can resolve them,
  // rather than the blank placeholder.
  return recoverVariableLookup(source, node.position.start, cursor);
}

// Rebuilds the `contentForType` String node for a `content_for` tag whose
// markup the parser left as a raw string (a bare partial arg name with no
// colon). Returns `undefined` while the caret is still in/at the block-name
// slot (no comma yet), so it never misfires on block-name completion.
function synthContentForType(
  node: any,
  cursor: number,
  source: string,
): LiquidHtmlNode | undefined {
  const region = source.slice(node.position.start, cursor);
  const m = region.match(/^\{%-?\s*content_for\s+(['"])([^'"]*)\1\s*,/);
  if (!m) return undefined;
  const quote = m[1];
  const value = m[2];
  const start = node.position.start + m[0].indexOf(quote);
  return {
    type: NodeTypes.String,
    value,
    single: quote === "'",
    position: { start, end: start + value.length + 2 },
  } as any as LiquidHtmlNode;
}

/*
 * The tolerant parser KEEPS a bare trailing `|` inside the markup node's span
 * (it is not dropped), so the markup covers the caret in both the empty-slot and
 * the partial-name cases — `position.end` vs caret cannot tell them apart. The
 * real empty-filter-slot signal is source-level: the text from the end of the
 * last parsed filter (or, with no filters, the end of the pre-pipe expression)
 * up to the caret is a single trailing bare `|` with a whitespace-only tail.
 *
 * `{% assign %}` markup is an `AssignMarkup` whose filters live on the child
 * `value` (a `LiquidVariable`), so unwrap it first. A partial filter name
 * (`{{ x | de^ }}`) is already parsed into a filter ending at the caret, so the
 * scanned tail is empty and this returns false — leaving those to the normal
 * parsed-filter descent.
 */
function hasTrailingEmptyFilterSlot(markup: any, cursor: number, source: string): boolean {
  const variable = markup?.type === NodeTypes.AssignMarkup ? markup.value : markup;
  if (!variable || typeof variable !== 'object') return false;
  const filters = variable.filters;
  const scanStart =
    Array.isArray(filters) && isNotEmpty(filters)
      ? last(filters)?.position?.end
      : variable.expression?.position?.end;
  if (typeof scanStart !== 'number' || scanStart > cursor) return false;
  return /^\s*\|\s*$/.test(source.slice(scanStart, cursor));
}

/*
 * For a `{{ ... }}` output whose markup the parser left as a raw string, the
 * filter or filter-argument slot after a pipe is empty (`{{ x | ^ }}`,
 * `{{ x | upcase | ^ }}`, `{{ x | image_url: ^ }}`). We synthesize the
 * `LiquidVariable` subtree that slot expects — the recovered expression plus a
 * completed filter chain plus a trailing empty filter — so the descent below
 * bottoms out on the empty filter (a bare pipe: the filter-name provider
 * completes there) or on the filter's empty argument lookup (after `name:`:
 * the named-parameter provider completes there).
 *
 * Returns undefined for a pipe-less output (`{{ ^ }}`, `{{ a.b^ }}`), leaving
 * the previous behaviour intact — those object slots are handled elsewhere.
 */
function synthOutputFilterSlot(
  output: any,
  cursor: number,
  source: string,
): LiquidHtmlNode | undefined {
  const open = output.position.start;
  const exprStart = open + (source.slice(open, cursor).match(/^\{\{-?\s*/)?.[0].length ?? 0);
  return synthFilterSlot(source, exprStart, cursor);
}

/*
 * Builds the `LiquidVariable` -> filter-chain subtree an empty filter or
 * filter-argument slot after a pipe expects, given the offset where the pre-pipe
 * expression begins (`exprStart`). Shared by the output path
 * (`synthOutputFilterSlot`) and the tag path (`synthTagFilterSlot`), so both
 * narrow completions by the pre-pipe expression's type via `recoverExpression`.
 * The descent below bottoms out on the empty filter (a bare pipe: the
 * filter-name provider completes there) or on the filter's empty argument lookup
 * (after `name:`: the named-parameter provider completes there).
 *
 * Returns undefined when there is no pipe before the caret (a non-filter slot),
 * leaving the caller's pipe-less behaviour intact.
 */
function synthFilterSlot(
  source: string,
  exprStart: number,
  cursor: number,
): LiquidHtmlNode | undefined {
  const region = source.slice(exprStart, cursor);
  const lastPipe = region.lastIndexOf('|');
  if (lastPipe === -1) return undefined;

  const firstPipe = region.indexOf('|');
  const firstPipeStart = exprStart + firstPipe;
  const lastPipeStart = exprStart + lastPipe;

  // The expression is everything before the first pipe; recover it (trailing
  // whitespace trimmed) so the synthesized variable carries the real lookup —
  // or a typed literal node, so a literal pre-pipe narrows the filter set.
  let exprEnd = firstPipeStart;
  while (exprEnd > exprStart && /\s/.test(source[exprEnd - 1])) exprEnd -= 1;
  const expression = recoverExpression(source, exprStart, exprEnd);
  const completedFilters = synthCompletedFilters(source, firstPipeStart + 1, lastPipeStart);

  // The text after the last pipe decides the slot: `name:` is an empty named
  // argument (so we descend to the argument lookup), anything else is an empty
  // filter slot (so we stop on the filter itself).
  const tail = region.slice(lastPipe + 1);

  /*
   * `tail` includes the filter name. A trailing `filterName: ...argName:` with
   * an empty value is a named-argument VALUE slot — offer value expressions,
   * not filter names. The first-argument slot (`filter: ^`) has an empty args
   * portion and keeps its existing bare-lookup shape (do not regress it).
   */
  const colonIdx = tail.indexOf(':');
  const filterName =
    colonIdx === -1
      ? undefined
      : tail
          .slice(0, colonIdx)
          .trim()
          .match(/^[a-zA-Z_][\w-]*$/)?.[0];
  const argsPortion = colonIdx === -1 ? '' : tail.slice(colonIdx + 1);
  const valueSlot = argsPortion.match(/([a-zA-Z_][\w-]*)\s*:\s*$/);

  let filter: LiquidHtmlNode;
  if (filterName && valueSlot) {
    /*
     * Absolute offset of the argument name so the finder's name-guard resolves
     * to the VALUE (cursor is past `argName:`), not the name.
     */
    const argStart = exprStart + lastPipe + 1 + colonIdx + 1 + valueSlot.index!;
    const namedArg = {
      type: NodeTypes.NamedArgument,
      name: valueSlot[1],
      value: synthVariableLookup(cursor),
      position: { start: argStart, end: cursor },
    } as any as LiquidHtmlNode;
    filter = synthFilter(filterName, [namedArg], cursor, source);
  } else {
    const named = tail.match(/^\s*([a-zA-Z_][\w-]*)\s*:\s*$/);
    filter = named
      ? synthFilter(named[1], [synthVariableLookup(cursor)], cursor, source)
      : synthFilter('', [], cursor, source);
  }

  return {
    type: NodeTypes.LiquidVariable,
    expression,
    filters: [...completedFilters, filter],
    position: { start: exprStart, end: cursor },
    source,
  } as any as LiquidHtmlNode;
}

/*
 * For a TAG whose markup the parser left a raw string, the filter or
 * filter-argument slot after a pipe is empty (`{% echo s | ^ %}`,
 * `{% assign x = "s" | ^ %}`). Locate where the pre-pipe expression begins —
 * just past the tag name, or, for `assign`, past the `= ` that separates the
 * target from the value — and delegate to the shared `synthFilterSlot` so tag
 * filters narrow by input type exactly like the output path.
 */
function synthTagFilterSlot(node: any, cursor: number, source: string): LiquidHtmlNode | undefined {
  const region = source.slice(node.position.start, cursor);
  /*
   * The `{%` prefix is optional so `exprStart` also skips the bare tag name of
   * a `{% liquid %}` inner statement (which has no `{%`). Needed so
   * `recoverExpression` sees a bare literal (`echo "s" | ^` -> String -> string
   * filters, not an untyped lookup). Harmless for non-literal inner statements
   * (`recoverVariableLookup` back-scans regardless) and byte-identical for
   * top-level `{%`-prefixed tags.
   */
  let exprStart =
    node.position.start + (region.match(/^(?:\{%-?\s*)?[a-zA-Z_]\w*\s+/)?.[0].length ?? 0);

  if (node.name === 'assign') {
    // `assign` binds a variable, so the pre-pipe expression is the assigned
    // value: skip past the first `=` and its trailing whitespace.
    const eq = source.indexOf('=', exprStart);
    if (eq !== -1 && eq < cursor) {
      exprStart = eq + 1;
      while (exprStart < cursor && /\s/.test(source[exprStart])) exprStart += 1;
    }
  }

  return synthFilterSlot(source, exprStart, cursor);
}

/*
 * Recovers completed filters before the trailing completion pipe in raw output
 * markup (`{{ string | split: "" | ^ }}`). The filter-name provider infers the
 * input type by cloning the parent variable and removing only the completing
 * filter, so the synthesized parent must retain the already-completed chain.
 * Arguments are not inspected for normal filter return types; names and source
 * spans are enough for the type system to resolve each completed filter.
 */
function synthCompletedFilters(source: string, start: number, end: number): LiquidHtmlNode[] {
  const filters: LiquidHtmlNode[] = [];
  let segmentStart = start;
  let quote: "'" | '"' | undefined;

  for (let i = start; i <= end; i++) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = undefined;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }

    if (i === end || ch === '|') {
      const filter = synthCompletedFilter(source, segmentStart, i);
      if (filter) filters.push(filter);
      segmentStart = i + 1;
    }
  }

  return filters;
}

function synthCompletedFilter(
  source: string,
  segmentStart: number,
  segmentEnd: number,
): LiquidHtmlNode | undefined {
  let start = segmentStart;
  while (start < segmentEnd && /\s/.test(source[start])) start += 1;

  const match = source.slice(start, segmentEnd).match(/^([a-zA-Z_][\w-]*)/);
  if (!match) return undefined;

  const name = match[1];
  return {
    type: NodeTypes.LiquidFilter,
    name,
    args: [],
    source,
    position: { start, end: segmentEnd },
  } as any as LiquidHtmlNode;
}

/*
 * Synthesizes a `LiquidFilter` at the caret. An empty `args` array marks an
 * empty filter slot (the filter-name provider completes against the filter
 * itself); a single synthesized lookup in `args` marks an empty named-argument
 * slot (the descent walks into that lookup). `name` holds the filter name the
 * slot resolves parameters for, and `source` is the full document source the
 * filter provider reads when building its text edits.
 */
function synthFilter(
  name: string,
  args: LiquidHtmlNode[],
  cursor: number,
  source: string,
): LiquidHtmlNode {
  return {
    type: NodeTypes.LiquidFilter,
    name,
    args,
    source,
    position: { start: cursor, end: cursor },
  } as any as LiquidHtmlNode;
}

/*
 * For an UNCLOSED `{{ ... | ... ` output (a document error node, so
 * `synthOutputFilterSlot` on the closed path never runs), the filter or
 * filter-argument slot after a pipe carries the partial the caret is typing.
 * We synthesize the `LiquidVariable` -> `LiquidFilter` -> argument subtree the
 * filter providers complete against, carrying that partial — which the closed
 * helper deliberately drops. `synthOutputFilterSlot` is left untouched.
 *
 * `exprStart` is the offset just past the `{{`. The expression is everything
 * before the first pipe (recovered like `synthOutputFilterSlot`, prior filters
 * in a chain dropped). The text after the LAST pipe (`tail`) selects the shape:
 *
 *   - `name: partial` (no comma): an argument slot on a single-argument filter.
 *     The leaf is the argument `VariableLookup` carrying `partial`.
 *   - `name: a, b, partial` (a comma): an argument slot on a multi-argument
 *     filter. The filter name is the first identifier before the first colon;
 *     the completing slot is the token after the LAST comma. This only fires
 *     when that trailing slot is a bare identifier (or empty) — never inside a
 *     value or string (`crop: '^'`), which falls through so no filter-parameter
 *     completion is offered there.
 *   - `partial` (no colon): a bare filter-name slot. The leaf is the
 *     `LiquidFilter` itself (the filter-name provider completes there).
 *
 * Returns undefined for a pipe-less output or a trailing value/string slot,
 * leaving the bare-lookup recovery intact.
 */
function synthUnclosedOutputFilter(
  source: string,
  exprStart: number,
  cursor: number,
  ancestors: LiquidHtmlNode[],
): [node: LiquidHtmlNode, ancestry: LiquidHtmlNode[]] | undefined {
  const region = source.slice(exprStart, cursor);
  const lastPipe = region.lastIndexOf('|');
  if (lastPipe === -1) return undefined;

  let exprEnd = exprStart + region.indexOf('|');
  while (exprEnd > exprStart && /\s/.test(source[exprEnd - 1])) exprEnd -= 1;
  const expression = recoverVariableLookup(source, exprStart, exprEnd);

  const tail = region.slice(lastPipe + 1);

  // Builds the argument leaf carrying the typed partial. An empty slot reuses
  // the blank `synthVariableLookup`; a partial carries its own name-token span
  // so `completionPartial` recovers exactly what was typed.
  const synthArg = (ident: string): LiquidHtmlNode =>
    ident === ''
      ? synthVariableLookup(cursor)
      : ({
          type: NodeTypes.VariableLookup,
          name: ident,
          lookups: [],
          position: { start: cursor - ident.length, end: cursor },
        } as any as LiquidHtmlNode);

  const buildVariable = (filter: LiquidHtmlNode): LiquidHtmlNode =>
    ({
      type: NodeTypes.LiquidVariable,
      expression,
      filters: [filter],
      position: { start: exprStart, end: cursor },
      source,
    }) as any as LiquidHtmlNode;

  // Multi-argument filter (`name: a, b, ^`).
  if (tail.includes(',')) {
    const nameMatch = tail.slice(0, tail.indexOf(':')).match(/[a-zA-Z_][\w-]*/);
    const filterName = nameMatch ? nameMatch[0] : '';
    const segment = tail.slice(tail.lastIndexOf(',') + 1);
    if (!/^\s*([a-zA-Z_][\w-]*)?\s*$/.test(segment)) return undefined;

    const identMatch = segment.match(/[a-zA-Z_][\w-]*/);
    const arg = synthArg(identMatch ? identMatch[0] : '');
    const filter = synthFilter(filterName, [arg], cursor, source);
    return [arg, [...ancestors, buildVariable(filter), filter]];
  }

  // Single-argument slot (`name: ^`, `name: partial^`).
  const named = tail.match(/^\s*([a-zA-Z_][\w-]*)\s*:\s*([a-zA-Z_][\w-]*)?\s*$/);
  if (named) {
    const arg = synthArg(named[2] ?? '');
    const filter = synthFilter(named[1], [arg], cursor, source);
    return [arg, [...ancestors, buildVariable(filter), filter]];
  }

  // Bare filter-name slot (`^`, `partial^`) — the leaf is the filter itself.
  const bare = tail.match(/^\s*([a-zA-Z_][\w-]*)?\s*$/);
  if (bare) {
    const partial = bare[1] ?? '';
    const filter = {
      type: NodeTypes.LiquidFilter,
      name: partial,
      args: [],
      source,
      position: { start: partial ? cursor - partial.length : cursor, end: cursor },
    } as any as LiquidHtmlNode;
    return [filter, [...ancestors, buildVariable(filter)]];
  }

  return undefined;
}

/*
 * Whether the caret sits in the tag's expression region rather than on the tag
 * name itself. Keyed on there being whitespace between the tag name and the
 * caret (`{% echo ^` yes; `{% ren^` no), so caret-on-name cases keep completing
 * the tag name instead of a synthesized lookup.
 */
function isInExpressionSlot(node: any, cursor: number, source: string): boolean {
  /*
   * `[a-zA-Z_]\w*` (rather than `[\w-]+`) so the whitespace-control dash of
   * `{%- if^` is not mistaken for a one-character tag name, which would put the
   * caret past a "name" and wrongly synthesize a lookup on `{%- if^ %}`.
   *
   * The `{%` prefix is optional so this also covers `{% liquid %}` inner
   * statements, whose region begins at the bare tag name (`echo`/`assign`),
   * not at `{%`. Top-level regions start with `{`, so the optional-prefix
   * branch matches inner-liquid statements only.
   */
  return /^(?:\{%-?\s*)?[a-zA-Z_]\w*\s/.test(source.slice(node.position.start, cursor));
}

function isTrailingLiquidTagMarkupSlot(node: any, cursor: number, source: string): boolean {
  const markup = source.slice(node.position.start, cursor).replace(/^\{%-?\s*[a-zA-Z_]\w*\s*/, '');
  if (!/\s$/.test(markup)) return false;

  if (node.name === 'for') {
    return (
      /\bas\s+[a-zA-Z_]\w*\s*$/.test(markup) ||
      /\breversed\s*$/.test(markup) ||
      /\breversed\s+limit\s*:\s*(?:\d+(?:\.\d+)?|(['"])[^'"]*\1)\s*$/.test(markup)
    );
  }

  if (node.name === 'if') {
    return /\bas\s+[a-zA-Z_]\w*\s*$/.test(markup);
  }

  return false;
}

type NonEmptyArray<T> = [T, ...T[]];

/*
 * Returns the last node whose `position` covers the cursor, or undefined when
 * none do. This replaces the old `last(children)` selection: on the resilient
 * full AST the node under the cursor is not necessarily the trailing node, so
 * we descend into the covering child instead. Typed as `any[]` so it reads
 * the array off a discriminated-union node without narrowing the whole node.
 */
function covering(nodes: any[], cursor: number): LiquidHtmlNode | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node && node.position && isCovered(cursor, node.position)) {
      return node;
    }
  }
  return undefined;
}

/*
 * Narrows away a nullish property the way the `!!` body does at runtime.
 * Generic over `T` so the predicate INTERSECTS the input (`T & { [k]: {} }`)
 * rather than replacing it: for an `any`-typed caller `any & {…}` stays `any`
 * (the `blockEndPosition` sites keep `.start`/`.end`), while for a concrete
 * discriminated union the per-arm intersection collapses a `null` property to
 * `never` (`null & {}`), stripping the `ifchanged` arm's `markup: null` at the
 * `:231` completion walk. (`NonNullable<T>` is literally `T & {}` since TS 4.8;
 * the old `NonNullable<any>` resolved to `any` and stripped nothing.) `thing`
 * is unconstrained, so the `in`/index touch-points are cast to `any` — runtime
 * is unchanged.
 */
function hasNonNullProperty<T, K extends PropertyKey>(
  thing: T,
  property: K,
): thing is T & { [k in K]: {} } {
  return thing !== null && property in (thing as any) && !!(thing as any)[property];
}

function isIncompleteBlockTag(thing: any): thing is { children: NonEmptyArray<any> } {
  return (
    hasNonEmptyArrayProperty(thing, 'children') &&
    (!hasNonNullProperty(thing, 'blockEndPosition') ||
      (thing.blockEndPosition.start === -1 && thing.blockEndPosition.end === -1))
  );
}

function isCompletedTag(thing: any) {
  return (
    hasNonNullProperty(thing, 'blockEndPosition') &&
    thing.blockEndPosition.start !== -1 &&
    thing.blockEndPosition.end !== -1
  );
}

function hasNonEmptyArrayProperty<T, K extends PropertyKey>(
  thing: T,
  property: K,
): thing is T & { [k in K]: NonEmptyArray<any> } {
  return (
    thing !== null &&
    property in (thing as any) &&
    Array.isArray((thing as any)[property]) &&
    !isEmpty((thing as any)[property])
  );
}

function isInLiquidLiquidTagContext(finder: Finder): boolean {
  return finder.stack.some(isLiquidLiquidTag);
}

function isLiquidLiquidTag(
  node: LiquidHtmlNode | undefined,
): node is LiquidTag & { name: 'liquid' } {
  if (!node) return false;
  return node.type === NodeTypes.LiquidTag && node.name === 'liquid';
}

function isCoveredExcluded(cursor: number, position: Position): boolean {
  return position.start <= cursor && cursor < position.end;
}

function isCovered(cursor: number, position: Position): boolean {
  return position.start <= cursor && cursor <= position.end;
}

function isNotEmpty<T = any>(x: T[]): x is NonEmptyArray<T> {
  return x.length > 0;
}

function isEmpty(x: any[]): x is [] {
  return x.length === 0;
}

function isDefined<T>(x: T | undefined): x is T {
  return x !== undefined;
}

function isBlockArrayArgument(arg: any): arg is { value: { elements: LiquidHtmlNode[] } } {
  return arg.value?.type === 'BlockArrayLiteral';
}

function last<T = any>(x: NonEmptyArray<T>): T {
  return x[x.length - 1];
}

function assertNever(x: never): never {
  throw new Error(`This function should never be called, but was called with ${x}`);
}
