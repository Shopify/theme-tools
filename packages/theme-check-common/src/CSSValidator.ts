import postcss, { CssSyntaxError, Root } from 'postcss';
import safeParser from 'postcss-safe-parser';
import selectorParser from 'postcss-selector-parser';
import { getOffset } from './utils/position';

export interface CSSProblem {
  message: string;
  startIndex: number;
  endIndex: number;
}

export interface CSSValidationResult {
  /** The parsed CSS AST, or null if parsing failed completely */
  root: Root | null;
  /** Any problems found during parsing */
  problems: CSSProblem[];
}

/**
 * CSS Modules-compliant selector rules:
 *
 * .button { }              ✅ valid (class selector)
 * div.button { }           ✅ valid (compound with class)
 * .button div { }          ✅ valid (complex selector with class)
 * div .button { }          ✅ valid (complex selector with class)
 * .button[type] { }        ✅ valid (compound with class)
 * .button * { }            ✅ valid (complex selector with class)
 * .a, .b { }               ✅ valid (each selector has a class)
 *
 * div { }                  ❌ invalid (no class selector)
 * * { }                    ❌ invalid (no class selector)
 * [type] { }               ❌ invalid (no class selector)
 * .a, div { }              ❌ invalid (second selector has no class)
 *
 * #id { }                  ❌ invalid (ID selectors always forbidden)
 * .button #id { }          ❌ invalid (ID selectors always forbidden)
 * #id.button { }           ❌ invalid (ID selectors always forbidden)
 *
 * Nested CSS rules:
 * .parent { div { } }      ✅ valid (flattens to .parent div - has class)
 * div { .child { } }       ✅ valid (flattens to div .child - has class)
 * div { span { } }         ❌ invalid (flattens to div span - no class)
 *
 * Note: Rules without declarations (only nested rules) are not flagged:
 * div { .child { color: red; } }  ✅ div is not flagged (no declarations)
 * div { color: red; }             ❌ div is flagged (has declarations, no class)
 */
export class CSSValidator {
  static create(): CSSValidator {
    return new CSSValidator();
  }

  /**
   * Parse and validate CSS syntax.
   *
   * Returns the parsed AST and any syntax problems found.
   * Use this for basic CSS validation before applying additional rules.
   */
  public validate(uri: string, cssString: string): CSSValidationResult {
    const problems: CSSProblem[] = [];
    let root: Root | null = null;

    try {
      // Parse with safe parser to catch syntax issues while being tolerant
      root = postcss().process(cssString, {
        parser: safeParser,
        from: uri,
      }).root;

      // Check for parse errors that safe-parser recovered from
      this.checkForParseWarnings(root, cssString, problems);
    } catch (error) {
      // Handle any unexpected errors
      if (error instanceof CssSyntaxError) {
        problems.push({
          message: error.reason || error.message,
          startIndex: getOffset(cssString, error.line ?? 1, error.column ?? 1),
          endIndex: getOffset(cssString, error.line ?? 1, (error.column ?? 1) + 1),
        });
      } else {
        throw error;
      }
    }

    return { root, problems };
  }

  /**
   * Validate selectors for CSS Modules compliance.
   *
   * Call this after `validate()` to check selector restrictions:
   * - ID selectors are always forbidden
   * - Each selector (including nested) must have a class somewhere in its path
   * - If any selector in a selector list is invalid, the entire group is flagged
   *
   * @param root - The parsed CSS AST from `validate()`
   * @param cssString - The original CSS string (for calculating positions)
   * @returns Array of problems found
   */
  public validateCssModuleSelectors(root: Root, cssString: string): CSSProblem[] {
    const problems: CSSProblem[] = [];

    root.walkRules((rule) => {
      // Skip @keyframes rules - they use percentage selectors, not CSS selectors
      const atRule = rule.parent;
      if (atRule && 'name' in atRule && String(atRule.name).includes('keyframes')) {
        return;
      }

      try {
        // Check for ID selectors in current rule (always forbidden)
        const idError = this.checkForIdSelectors(rule.selector);
        if (idError) {
          const start = rule.source?.start;
          if (start) {
            const selectorStart = getOffset(cssString, start.line, start.column);
            problems.push({
              message: idError,
              startIndex: selectorStart,
              endIndex: selectorStart + rule.selector.length,
            });
          }
          return; // Don't check class requirement if ID found
        }

        // Only check class requirement if the rule has declarations
        // Rules that only contain nested rules (no declarations) don't need a class
        // e.g., `div { .child { color: red; } }` - div has no declarations, only nested rules
        const hasDeclarations = rule.nodes?.some((node) => node.type === 'decl') ?? false;
        if (!hasDeclarations) {
          return; // Skip class check for rules without declarations
        }

        // Check if current selector or any ancestor has a class
        const hasClassInPath = this.hasClassInSelectorPath(rule);

        if (!hasClassInPath) {
          const start = rule.source?.start;
          if (start) {
            const selectorStart = getOffset(cssString, start.line, start.column);
            problems.push({
              message: `Selector must contain at least one class selector`,
              startIndex: selectorStart,
              endIndex: selectorStart + rule.selector.length,
            });
          }
        }
      } catch {
        // If selector parsing fails, skip this rule
      }
    });

    return problems;
  }

  /**
   * Check if a selector string contains any ID selectors.
   * Returns an error message if found, or null if none.
   */
  private checkForIdSelectors(selectorString: string): string | null {
    let foundIdValue: string | null = null;

    try {
      selectorParser((selectors) => {
        selectors.walk((node) => {
          if (node.type === 'id') {
            foundIdValue = node.value;
          }
        });
      }).processSync(selectorString);
    } catch {
      // Ignore parse errors
    }

    if (foundIdValue !== null) {
      return `ID selectors are not allowed (found "#${foundIdValue}")`;
    }

    return null;
  }

  /**
   * Check if a selector string contains any class selectors.
   */
  private hasClassInSelector(selectorString: string): boolean {
    let hasClass = false;

    try {
      selectorParser((selectors) => {
        selectors.walk((node) => {
          if (node.type === 'class') {
            hasClass = true;
          }
        });
      }).processSync(selectorString);
    } catch {
      // Ignore parse errors
    }

    return hasClass;
  }

  /**
   * Check if a rule or any of its ancestor rules contains a class selector.
   * This handles nested CSS where the flattened path may have a class in an ancestor.
   */
  private hasClassInSelectorPath(rule: postcss.Rule): boolean {
    // Check current rule's selector
    if (this.hasClassInSelector(rule.selector)) {
      return true;
    }

    // Walk up the parent chain to check ancestor selectors (for nested CSS)
    let current: postcss.Container | postcss.Document | undefined = rule.parent;
    while (current) {
      if (current.type === 'rule') {
        const parentRule = current as postcss.Rule;
        if (this.hasClassInSelector(parentRule.selector)) {
          return true;
        }
      }
      current = current.parent;
    }

    return false;
  }

  /**
   * Check for issues that postcss-safe-parser recovered from.
   * These indicate malformed CSS that browsers would also have trouble with.
   */
  private checkForParseWarnings(root: Root, cssString: string, problems: CSSProblem[]): void {
    // Walk through all nodes and look for issues
    root.walk((node) => {
      // Check for nodes without proper source positions (indicates recovery)
      if (node.type === 'decl') {
        // Check for declarations outside of rules (invalid CSS)
        if (node.parent?.type === 'root') {
          const start = node.source?.start;
          if (start) {
            problems.push({
              message: `Unexpected declaration outside of a rule: "${node.prop}"`,
              startIndex: getOffset(cssString, start.line, start.column),
              endIndex: getOffset(
                cssString,
                node.source?.end?.line ?? start.line,
                node.source?.end?.column ?? start.column + node.toString().length,
              ),
            });
          }
        }
      }

      // Check for raw/unparseable content at root level
      if (node.type === 'rule' && node.parent?.type === 'root') {
        // Check if the selector looks like bare text (no valid CSS selector characters)
        const selector = node.selector.trim();
        if (selector && !this.isValidSelector(selector)) {
          const start = node.source?.start;
          if (start) {
            problems.push({
              message: `Invalid or unexpected content: "${selector}"`,
              startIndex: getOffset(cssString, start.line, start.column),
              endIndex: getOffset(
                cssString,
                node.source?.end?.line ?? start.line,
                node.source?.end?.column ?? start.column + selector.length,
              ),
            });
          }
        }
      }
    });
  }

  /**
   * Basic check if a string looks like a valid CSS selector
   */
  private isValidSelector(selector: string): boolean {
    // Valid selectors typically start with: . # [ * : or a letter
    // and contain valid selector characters
    const validSelectorPattern = /^[.#\[*:\w@]|^\s*[.#\[*:\w@]/;
    return validSelectorPattern.test(selector);
  }
}
