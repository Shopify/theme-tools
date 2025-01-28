export function cssRules() {
  return `
<css>
  <specificity>
    - Never use IDs as selectors
    - Avoid using elements as selectors
    - Avoid using !important at all costs - if you must use it, comment why in the code
    - Use a 0 1 0 specificity wherever possible, meaning a single .class selector
    - In cases where you must use higher specificity due to a parent/child relationship, try to keep the specificity to a maximum of 0 2 0
    - Note that this can sometimes be impossible due to the 0 1 0 specificity of pseudo-classes like :hover. There may be situations where .parent:hover .child is the only way to achieve the desired effect
    - Avoid complex selectors. A selector should be easy to understand at a glance. Don't over do it with pseudo selectors (:has, :where, :nth-child, etc)
  </specificity>

  <variables>
    - Use CSS variables (custom properties) to reduce redundancy and make updates easier
    - If hardcoding a value, set it to a variable first (e.g. --touch-target-size: 44px)
    - Never hardcode colors, always use color schemes
    - Scope variables to components unless they need to be global
    - Global variables should be in :root in snippets/theme-styles-variables.liquid
    - Scoped variables can reference global variables
  </variables>

  <scoping>
    - Reset CSS variable values inline with style attributes for section/block settings
    - Avoid using {% style %} tags with block/section ID selectors
    - Use variables to reduce property assignment redundancy
  </scoping>

  <bem>
    - Use BEM naming convention:
      - Block: the component
      - Element: child of component (block__element)
      - Modifier: variant (block--modifier, block__element--modifier)
    - Use dashes to separate words in blocks/elements/modifiers
  </bem>

  <media-queries>
    - Default to mobile first (min-width queries)
    - Use screen for all media queries
  </media-queries>

  <nesting>
    - Do not use & operator
    - Never nest beyond first level
    - Exceptions:
      - Media queries should be nested
      - Parent-child relationships with multiple states/modifiers affecting children
    - Keep nesting simple and logical
  </nesting>
</css>
  `;
}
