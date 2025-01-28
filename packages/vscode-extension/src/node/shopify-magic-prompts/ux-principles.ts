export function uxPrinciplesRules() {
  return `
    <ux_principles>
      <settings>
        <general_guidance>
          Keep it simple, clear, and non-repetitive.

          - The setting type can provide context that the setting label doesn't need to provide. Example: "Number of columns" can simply be "Columns" if the input indicates that it's a number value.
          - Assume all settings to be device-agnostic, with graceful scaling between breakpoints. Only mention mobile or desktop if there is a unique setting required.
          - Use common shorthand where it makes sense. Example: Max/Min to mean Maximum and Minimum. Caveat: ensure these values are translated/localized correctly
          - Help text: Minimize use as much as possible. If really required, make it short and remove punctuation unless it's more than 1 sentence (but it shouldn't be!)
        </general_guidance>

        <information_architecture>
          <ordering>
            The order of theme settings greatly impacts the merchant's ability to understand and configure the section/block.

            - List settings to reflect the order of elements they control in the preview. Top to bottom, left to right, background to foreground.
            - List resource pickers first, if they're needed, followed by customization settings. Focus on what the merchant needs to take action on in order for the section/block to function. Example: a featured collection block needs the merchant to choose a collection before deciding the number of products per row.
            - List settings in order of visual impact, example: Number of products per row should come before the product card settings.
          </ordering>

          <groupings>
            Consider grouping settings under a heading if there are more than 1 related setting. List ungrouped settings at the top of the section/block.

            Common groupings:

            - Layout
            - Typography
            - Colors
            - Padding
          </groupings>

          <naming>
            Remove word duplication in the heading and nested labels. When a word appears in a heading (e.g. "Color"), it should not be repeated in nested setting labels or help text. The hierarchy of information provides sufficient context.
          </naming>

          <conditional>
            Use conditional settings when it:

            - simplifies decision-making for merchants via progressive disclosure
            - avoids duplication of settings
            - avoids visual clutter and reduces cognitive load

            Conditional settings should appear in the information architecture wherever they're most relevant. That might be directly below the trigger setting, or it could be a whole separate group of settings that are surfaced elsewhere where it makes sense for the merchant.

            Tradeoffs and considerations of conditional settings:

            - They hide functionality/options that help merchants decide how style their website, so be judicious in what concepts you tie together. For example, don't make a Product card's "Swatch display" setting conditional on a "Quick buy" setting. They are both related to variant selection, but they serve different purposes.
            - Limit conditions to 2 levels deep to avoid complex logic (up for discussion!)
            - Even when not shown, a conditional setting's value is evaluated in the Liquid code. Code defensively, never assume a theme setting's value is nil.
          </conditional>

          <input_type>
            **Checkbox**: Treat checkbox as an on/off switch. Avoid using verb-based labels, example: use "Language selector" and not "Enable language selector". The presence of the verb may inadvertently suggest the direction to toggle to enable or disable it.

            **Select**: Keep select option labels as short as possible so they can be dynamically displayed as segmented controls
          </input_type>
        </information_architecture>
      </settings>

      <server_side_rendering>
        Storefronts are to be rendered server-side with Liquid as a first principle. As opposed to client-side JavaScript.

        When using JavaScript to render part of the page, fetch the new HTML from the server wherever possible.
        <optimistic_ui>
          This is the exception to the rule of server-side rendering

          "Optimistic UI" is the idea that we can update part of the UI before the server response is received in the name of **perceived performance**.

          Recommended reading:

          - [Optimistic UI Patterns for Improved Perceived Performance](https://simonhearne.com/2021/optimistic-ui-patterns/)
          - [True Lies Of Optimistic User Interfaces](https://www.smashingmagazine.com/2016/11/true-lies-of-optimistic-user-interfaces/)
          <criteria>
            Key factors to consider when deciding whether to use optimistic UI:

            1. You are updating a **small** portion of the UI on the client (with JavaScript) before the server response is received.
            2. The API request has a high degree of certainty of being successful.

            Examples of appropriate use cases:

            When filtering a collection page, we can update the a list of applied filters client-side as a Buyer chooses them, i.e. "Color: Red" or "Size: Medium". However, we do not know how many products will be returned that match the filters, so we can't update the product grid or a count of products.

            When a Buyer attempts to add an item to their cart, we can update the cart item count client-side. Assuming our product form's "add to cart" button is already checking the item's availability, we can have a reasonably high degree of certainty that the item will be added to the cart (API request is successful). However, we do not know what the new cart total will be, nor do we know what the line items will look like, so we can't update those in a cart drawer without waiting for the server response.
          </criteria>
        </optimistic_ui>
      </server_side_rendering>
    </ux_principles>
  `;
}
