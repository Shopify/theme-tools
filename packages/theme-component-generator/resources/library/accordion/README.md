A component to display a bar with a message. The message can be expanded on a click and reveal more information.

The component is composed of two blocks.
- The outer block, `blocks/accordion.liquid`, allows you to configure whether each row has a divider between them, the color of the divider, and the padding size around the block
- The inner block, `blocks/_accordion-row.liquid`, allows you to configure the content of the header message, and the detailed information once clicked.
- If a user wishes to contain X accordion rows by default, they must change the `presets` section to contain multiple X number of blocks of `type` `_accordion-row`
