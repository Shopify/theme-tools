/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */

import { LanguageModelChatMessage, TextEditor } from 'vscode';

export function buildMessages(textEditor: TextEditor) {
  const prompt = [
    basePrompt(textEditor),
    code(textEditor),
    codeContext(textEditor),
    themeArchitectureContext(),
    docsContext(),
  ];

  console.error(' message >>>>>>>');
  console.error(prompt.join('\n'));
  console.error(' message <<<<<<<');

  return prompt.map((message) => LanguageModelChatMessage.User(message));
}

function basePrompt(textEditor: TextEditor): string {
  const numberOfSuggestions = textEditor.selection.isEmpty ? 5 : 1;

  return `
    ## INSTRUCTIONS (REALLY IMPORTANT)

    You are Sidekick, an AI assistant designed to help Liquid developers optimize Shopify themes.

    Your goal is to identify and suggest opportunities for improvement in the "## CODE", focusing on the following areas:

    - Enhancing readability, conciseness, and efficiency while maintaining the same functionality
    - Leveraging new features in Liquid, including filters, tags, and objects
    - Be pragmatic and don't suggest without a really good reason
    - You should not suggest changes to the code that impact only HTML -- they should be focused on Liquid and Theme features.
    - You should not talk about whitespaces and the style of the code; leave that to the linter!

    At the same time, ensure the following is true:

    - The resulting code must work and should not break existing HTML tags or Liquid syntax. Make full-scope suggestions that consider the entire context of the code you are modifying
    - The new code you propose contain full lines of valid code and keep the correct indentation and style format as the original code
    - The suggestions are specific, actionable, and align with the best practices in Liquid and Shopify theme development
    - Add a maximum of ${numberOfSuggestions} distinct suggestions to the array
    - Code suggestions cannot overlap in line numbers. If you have multiple suggestions for the same code chunk, merge them into a single suggestion

    Use the "## THEME ARCHITECTURE", "## CONTEXT", the "## DOCS", and Shopify.dev context as a reference. Do not make up new information.

    Your response must be exclusively a valid and parsable JSON object with the following structure:

    {
      "reasonIfNoSuggestions": "<string|null: explanation of why there are no suggestions>",
      "suggestions": [
        {
          "newCode": "<string: the improved code to replace the current code>",
          "range": {
            "start": {
              "line": <number: start line where the new code starts>,
              "character": <number: start character where the new code starts>
            },
            "end": {
              "line": <number: end line where the new code ends>,
              "character": <number: end character where the new code ends>
            }
          },
          "line": <number: line for the suggestion>,
          "suggestion": "<string: up to 60 chars explanation of the improvement and its benefits>"
        }
      ]
    }

    Example of valid response:

    {
      "reasonIfNoSuggestions": null,
      "suggestions": [
        {
          "newCode": "{% assign first_product = products | first %}",
          "range": {
            "start": {
              "line": 5,
              "character": 0
            },
            "end": {
              "line": 7,
              "character": 42
            }
          },
          "line": 5,
          "suggestion": "Instead of using a for loop to get the first item, you could use the 'first' filter. This is more concise and clearly shows your intent."
        }
      ]
    }
  `;
}

function themeArchitectureContext(): string {
  return `
## THEME ARCHITECTURE

${Object.entries(THEME_ARCHITECTURE)
  .map(([key, value]) => `- ${key}: ${value.summary}`)
  .join('\n\n')}
`;
}

function code(textEditor: TextEditor) {
  const selection = textEditor.selection;
  const offset = selection.isEmpty ? 0 : selection.start.line;
  const text = textEditor.document.getText(selection.isEmpty ? undefined : selection);

  return `
    ## CODE

${text
  .split('\n')
  .map((line, index) => `${index + 1 + offset}: ${line}`)
  .join('\n')}
`;
}

function getFileType(path: string): string {
  const pathWithoutFile = path.substring(0, path.lastIndexOf('/'));
  const fileTypes = Object.keys(THEME_ARCHITECTURE);

  return fileTypes.find((type) => pathWithoutFile.endsWith(type)) || 'none';
}

function codeContext(textEditor: TextEditor) {
  const fileName = textEditor.document.fileName;
  const fileType = getFileType(fileName);
  const fileTip = THEME_ARCHITECTURE[fileType]?.tip ?? 'this is a regular Liquid file';

  return `
    ## CONTEXT

    - file name: ${fileName}
    - file type: ${fileType}
    - file context: ${fileTip}
`;
}

function docsContext() {
  return `
    ## DOCS


    #### LIQUID FILTERS

    - **NAME**: where			**USAGE**: array | where: string, string
    - **NAME**: reject			**USAGE**: array | reject: string, string
    - **NAME**: find			**USAGE**: array | find: string, string
    - **NAME**: find_index			**USAGE**: array | find_index: string, string
    - **NAME**: has			**USAGE**: array | has: string, string
    - **NAME**: item_count_for_variant			**USAGE**: cart | item_count_for_variant: {variant_id}
    - **NAME**: line_items_for			**USAGE**: cart | line_items_for: object
    - **NAME**: class_list			**USAGE**: settings.layout | class_list
    - **NAME**: link_to_type			**USAGE**: string | link_to_type
    - **NAME**: link_to_vendor			**USAGE**: string | link_to_vendor
    - **NAME**: sort_by			**USAGE**: string | sort_by: string
    - **NAME**: url_for_type			**USAGE**: string | url_for_type
    - **NAME**: url_for_vendor			**USAGE**: string | url_for_vendor
    - **NAME**: within			**USAGE**: string | within: collection
    - **NAME**: brightness_difference			**USAGE**: string | brightness_difference: string
    - **NAME**: color_brightness			**USAGE**: string | color_brightness
    - **NAME**: color_contrast			**USAGE**: string | color_contrast: string
    - **NAME**: color_darken			**USAGE**: string | color_darken: number
    - **NAME**: color_desaturate			**USAGE**: string | color_desaturate: number
    - **NAME**: color_difference			**USAGE**: string | color_difference: string
    - **NAME**: color_extract			**USAGE**: string | color_extract: string
    - **NAME**: color_lighten			**USAGE**: string | color_lighten: number
    - **NAME**: color_mix			**USAGE**: string | color_mix: string, number
    - **NAME**: color_modify			**USAGE**: string | color_modify: string, number
    - **NAME**: color_saturate			**USAGE**: string | color_saturate: number
    - **NAME**: color_to_hex			**USAGE**: string | color_to_hex
    - **NAME**: color_to_hsl			**USAGE**: string | color_to_hsl
    - **NAME**: color_to_rgb			**USAGE**: string | color_to_rgb
    - **NAME**: hex_to_rgba			**USAGE**: string | hex_to_rgba
    - **NAME**: hmac_sha1			**USAGE**: string | hmac_sha1: string
    - **NAME**: hmac_sha256			**USAGE**: string | hmac_sha256: string
    - **NAME**: md5			**USAGE**: string | md5
    - **NAME**: sha1			**USAGE**: string | sha1: string
    - **NAME**: sha256			**USAGE**: string | sha256: string
    - **NAME**: currency_selector			**USAGE**: form | currency_selector
    - **NAME**: customer_login_link			**USAGE**: string | customer_login_link
    - **NAME**: customer_logout_link			**USAGE**: string | customer_logout_link
    - **NAME**: customer_register_link			**USAGE**: string | customer_register_link
    - **NAME**: date			**USAGE**: string | date: string
    - **NAME**: font_face			**USAGE**: font | font_face
    - **NAME**: font_modify			**USAGE**: font | font_modify: string, string
    - **NAME**: font_url			**USAGE**: font | font_url
    - **NAME**: default_errors			**USAGE**: string | default_errors
    - **NAME**: payment_button			**USAGE**: form | payment_button
    - **NAME**: payment_terms			**USAGE**: form | payment_terms
    - **NAME**: time_tag			**USAGE**: string | time_tag: string
    - **NAME**: translate			**USAGE**: string | t
    - **NAME**: inline_asset_content			**USAGE**: asset_name | inline_asset_content
    - **NAME**: json			**USAGE**: variable | json
    - **NAME**: abs			**USAGE**: number | abs
    - **NAME**: append			**USAGE**: string | append: string
    - **NAME**: at_least			**USAGE**: number | at_least
    - **NAME**: at_most			**USAGE**: number | at_most
    - **NAME**: base64_decode			**USAGE**: string | base64_decode
    - **NAME**: base64_encode			**USAGE**: string | base64_encode
    - **NAME**: base64_url_safe_decode			**USAGE**: string | base64_url_safe_decode
    - **NAME**: base64_url_safe_encode			**USAGE**: string | base64_url_safe_encode
    - **NAME**: capitalize			**USAGE**: string | capitalize
    - **NAME**: ceil			**USAGE**: number | ceil
    - **NAME**: compact			**USAGE**: array | compact
    - **NAME**: concat			**USAGE**: array | concat: array
    - **NAME**: default			**USAGE**: variable | default: variable
    - **NAME**: divided_by			**USAGE**: number | divided_by: number
    - **NAME**: downcase			**USAGE**: string | downcase
    - **NAME**: escape			**USAGE**: string | escape
    - **NAME**: escape_once			**USAGE**: string | escape_once
    - **NAME**: first			**USAGE**: array | first
    - **NAME**: floor			**USAGE**: number | floor
    - **NAME**: join			**USAGE**: array | join
    - **NAME**: last			**USAGE**: array | last
    - **NAME**: lstrip			**USAGE**: string | lstrip
    - **NAME**: map			**USAGE**: array | map: string
    - **NAME**: minus			**USAGE**: number | minus: number
    - **NAME**: modulo			**USAGE**: number | modulo: number
    - **NAME**: newline_to_br			**USAGE**: string | newline_to_br
    - **NAME**: plus			**USAGE**: number | plus: number
    - **NAME**: prepend			**USAGE**: string | prepend: string
    - **NAME**: remove			**USAGE**: string | remove: string
    - **NAME**: remove_first			**USAGE**: string | remove_first: string
    - **NAME**: remove_last			**USAGE**: string | remove_last: string
    - **NAME**: replace			**USAGE**: string | replace: string, string
    - **NAME**: replace_first			**USAGE**: string | replace_first: string, string
    - **NAME**: replace_last			**USAGE**: string | replace_last: string, string
    - **NAME**: reverse			**USAGE**: array | reverse
    - **NAME**: round			**USAGE**: number | round
    - **NAME**: rstrip			**USAGE**: string | rstrip
    - **NAME**: size			**USAGE**: variable | size
    - **NAME**: slice			**USAGE**: string | slice
    - **NAME**: sort			**USAGE**: array | sort
    - **NAME**: sort_natural			**USAGE**: array | sort_natural
    - **NAME**: split			**USAGE**: string | split: string
    - **NAME**: strip			**USAGE**: string | strip
    - **NAME**: strip_html			**USAGE**: string | strip_html
    - **NAME**: strip_newlines			**USAGE**: string | strip_newlines
    - **NAME**: sum			**USAGE**: array | sum
    - **NAME**: times			**USAGE**: number | times: number
    - **NAME**: truncate			**USAGE**: string | truncate: number
    - **NAME**: truncatewords			**USAGE**: string | truncatewords: number
    - **NAME**: uniq			**USAGE**: array | uniq
    - **NAME**: upcase			**USAGE**: string | upcase
    - **NAME**: url_decode			**USAGE**: string | url_decode
    - **NAME**: url_encode			**USAGE**: string | url_encode
    - **NAME**: external_video_tag			**USAGE**: variable | external_video_tag
    - **NAME**: external_video_url			**USAGE**: media | external_video_url: attribute: string
    - **NAME**: image_tag			**USAGE**: string | image_tag
    - **NAME**: media_tag			**USAGE**: media | media_tag
    - **NAME**: model_viewer_tag			**USAGE**: media | model_viewer_tag
    - **NAME**: video_tag			**USAGE**: media | video_tag
    - **NAME**: metafield_tag			**USAGE**: metafield | metafield_tag
    - **NAME**: metafield_text			**USAGE**: metafield | metafield_text
    - **NAME**: money			**USAGE**: number | money
    - **NAME**: money_with_currency			**USAGE**: number | money_with_currency
    - **NAME**: money_without_currency			**USAGE**: number | money_without_currency
    - **NAME**: money_without_trailing_zeros			**USAGE**: number | money_without_trailing_zeros
    - **NAME**: default_pagination			**USAGE**: paginate | default_pagination
    - **NAME**: avatar			**USAGE**: customer | avatar
    - **NAME**: login_button			**USAGE**: shop | login_button
    - **NAME**: camelize			**USAGE**: string | camelize
    - **NAME**: handleize			**USAGE**: string | handleize
    - **NAME**: url_escape			**USAGE**: string | url_escape
    - **NAME**: url_param_escape			**USAGE**: string | url_param_escape
    - **NAME**: structured_data			**USAGE**: variable | structured_data
    - **NAME**: highlight_active_tag			**USAGE**: string | highlight_active_tag
    - **NAME**: link_to_add_tag			**USAGE**: string | link_to_add_tag
    - **NAME**: link_to_remove_tag			**USAGE**: string | link_to_remove_tag
    - **NAME**: link_to_tag			**USAGE**: string | link_to_tag
    - **NAME**: format_address			**USAGE**: address | format_address
    - **NAME**: highlight			**USAGE**: string | highlight: string
    - **NAME**: pluralize			**USAGE**: number | pluralize: string, string
    - **NAME**: article_img_url			**USAGE**: variable | article_img_url
    - **NAME**: asset_img_url			**USAGE**: string | asset_img_url
    - **NAME**: asset_url			**USAGE**: string | asset_url
    - **NAME**: collection_img_url			**USAGE**: variable | collection_img_url
    - **NAME**: file_img_url			**USAGE**: string | file_img_url
    - **NAME**: file_url			**USAGE**: string | file_url
    - **NAME**: global_asset_url			**USAGE**: string | global_asset_url
    - **NAME**: image_url			**USAGE**: variable | image_url: width: number, height: number
    - **NAME**: img_tag			**USAGE**: string | img_tag
    - **NAME**: img_url			**USAGE**: variable | img_url
    - **NAME**: link_to			**USAGE**: string | link_to: string
    - **NAME**: payment_type_img_url			**USAGE**: string | payment_type_img_url
    - **NAME**: payment_type_svg_tag			**USAGE**: string | payment_type_svg_tag
    - **NAME**: placeholder_svg_tag			**USAGE**: string | placeholder_svg_tag
    - **NAME**: preload_tag			**USAGE**: string | preload_tag: as: string
    - **NAME**: product_img_url			**USAGE**: variable | product_img_url
    - **NAME**: script_tag			**USAGE**: string | script_tag
    - **NAME**: shopify_asset_url			**USAGE**: string | shopify_asset_url
    - **NAME**: stylesheet_tag			**USAGE**: string | stylesheet_tag
    - **NAME**: weight_with_unit			**USAGE**: number | weight_with_unit


    #### LIQUID TAGS

    - **NAME**: content_for
    - **NAME**: form
    - **NAME**: layout
    - **NAME**: assign
    - **NAME**: break
    - **NAME**: capture
    - **NAME**: case
    - **NAME**: comment
    - **NAME**: continue
    - **NAME**: cycle
    - **NAME**: decrement
    - **NAME**: echo
    - **NAME**: for
    - **NAME**: if
    - **NAME**: include
    - **NAME**: increment
    - **NAME**: raw
    - **NAME**: render
    - **NAME**: tablerow
    - **NAME**: unless
    - **NAME**: paginate
    - **NAME**: javascript
    - **NAME**: section
    - **NAME**: stylesheet
    - **NAME**: sections
    - **NAME**: style
    - **NAME**: else
    - **NAME**: else
    - **NAME**: liquid


    #### LIQUID OBJECTS

    - **NAME**: media
    - **NAME**: address
    - **NAME**: collections
    - **NAME**: pages
    - **NAME**: all_products
    - **NAME**: app
    - **NAME**: discount
    - **NAME**: articles
    - **NAME**: article
    - **NAME**: block
    - **NAME**: blogs
    - **NAME**: blog
    - **NAME**: brand
    - **NAME**: cart
    - **NAME**: collection
    - **NAME**: brand_color
    - **NAME**: color
    - **NAME**: color_scheme
    - **NAME**: color_scheme_group
    - **NAME**: company_address
    - **NAME**: company
    - **NAME**: company_location
    - **NAME**: content_for_header
    - **NAME**: country
    - **NAME**: currency
    - **NAME**: customer
    - **NAME**: discount_allocation
    - **NAME**: discount_application
    - **NAME**: external_video
    - **NAME**: filter
    - **NAME**: filter_value_display
    - **NAME**: filter_value
    - **NAME**: focal_point
    - **NAME**: font
    - **NAME**: form
    - **NAME**: fulfillment
    - **NAME**: generic_file
    - **NAME**: gift_card
    - **NAME**: image
    - **NAME**: image_presentation
    - **NAME**: images
    - **NAME**: line_item
    - **NAME**: link
    - **NAME**: linklists
    - **NAME**: linklist
    - **NAME**: forloop
    - **NAME**: tablerowloop
    - **NAME**: localization
    - **NAME**: location
    - **NAME**: market
    - **NAME**: measurement
    - **NAME**: metafield
    - **NAME**: metaobject_definition
    - **NAME**: metaobject
    - **NAME**: metaobject_system
    - **NAME**: model
    - **NAME**: model_source
    - **NAME**: money
    - **NAME**: order
    - **NAME**: page
    - **NAME**: paginate
    - **NAME**: predictive_search
    - **NAME**: selling_plan_price_adjustment
    - **NAME**: product
    - **NAME**: product_option
    - **NAME**: product_option_value
    - **NAME**: swatch
    - **NAME**: variant
    - **NAME**: quantity_price_break
    - **NAME**: rating
    - **NAME**: recipient
    - **NAME**: recommendations
    - **NAME**: request
    - **NAME**: robots
    - **NAME**: group
    - **NAME**: rule
    - **NAME**: routes
    - **NAME**: script
    - **NAME**: search
    - **NAME**: section
    - **NAME**: selling_plan_allocation
    - **NAME**: selling_plan_allocation_price_adjustment
    - **NAME**: selling_plan_checkout_charge
    - **NAME**: selling_plan
    - **NAME**: selling_plan_group
    - **NAME**: selling_plan_group_option
    - **NAME**: selling_plan_option
    - **NAME**: shipping_method
    - **NAME**: shop
    - **NAME**: shop_locale
    - **NAME**: policy
    - **NAME**: store_availability
    - **NAME**: tax_line
    - **NAME**: taxonomy_category
    - **NAME**: theme
    - **NAME**: settings
    - **NAME**: template
    - **NAME**: transaction
    - **NAME**: unit_price_measurement
    - **NAME**: user
    - **NAME**: video
    - **NAME**: video_source
    - **NAME**: additional_checkout_buttons
    - **NAME**: all_country_option_tags
    - **NAME**: canonical_url
    - **NAME**: checkout
    - **NAME**: comment
    - **NAME**: content_for_additional_checkout_buttons
    - **NAME**: content_for_index
    - **NAME**: content_for_layout
    - **NAME**: country_option_tags
    - **NAME**: current_page
    - **NAME**: current_tags
    - **NAME**: form_errors
    - **NAME**: handle
    - **NAME**: page_description
    - **NAME**: page_image
    - **NAME**: page_title
    - **NAME**: part
    - **NAME**: pending_payment_instruction_input
    - **NAME**: powered_by_link
    - **NAME**: predictive_search_resources
    - **NAME**: quantity_rule
    - **NAME**: scripts
    - **NAME**: sitemap
    - **NAME**: sort_option
    - **NAME**: transaction_payment_details
    - **NAME**: user_agent
  `;
}

const THEME_ARCHITECTURE: { [key: string]: { summary: string; tip?: string } } = {
  sections: {
    summary: `Liquid files that define customizable sections of a page. They include blocks and settings defined via a schema, allowing merchants to modify them in the theme editor.`,
    tip: `As sections grow in complexity, consider extracting reusable parts into snippets for better maintainability. Also look for opportunities to make components more flexible by moving hardcoded values into section settings that merchants can customize.`,
  },
  blocks: {
    summary: `Configurable elements within sections that can be added, removed, or reordered. They are defined with a schema tag for merchant customization in the theme editor.`,
    tip: `Break blocks into smaller, focused components that each do one thing well. Look for opportunities to extract repeated patterns into separate block types. Make blocks more flexible by moving hardcoded values into schema settings, but keep each block's schema simple and focused on its specific purpose.`,
  },
  layout: {
    summary: `Defines the structure for repeated content such as headers and footers, wrapping other template files.`,
    tip: `Keep layouts focused on structural elements and look for opportunities to extract components into sections. Headers, footers, navigation menus, and other reusable elements should be sections to enable merchant customization through the theme editor.`,
  },
  snippets: {
    summary: `Reusable code fragments included in templates, sections, and layouts via the render tag. Ideal for logic that needs to be reused but not directly edited in the theme editor.`,
    tip: `Keep snippets focused on a single responsibility. Use variables to make snippets more reusable. Add a header comment block that documents expected inputs, dependencies, and any required objects/variables that need to be passed to the snippet. For example:
    {% doc %}
      Renders loading-spinner.

      @param {string} foo - some foo
      @param {string} [bar] - optional bar

      @example
      {% render 'loading-spinner', foo: 'foo' %}
      {% render 'loading-spinner', foo: 'foo', bar: 'bar' %}
    {% enddoc %}`,
  },

  // Removing the types below as they, generally, are not Liquid files.
  // config: {
  //   summary: `Holds settings data and schema for theme customization options like typography and colors, accessible through the Admin theme editor.`,
  // },
  // assets: {
  //   summary: `Contains static files such as CSS, JavaScript, and images. These assets can be referenced in Liquid files using the asset_url filter.`,
  // },
  // locales: {
  //   summary: `Stores translation files for localizing theme editor and storefront content.`,
  // },
  // templates: {
  //   summary: `JSON files that specify which sections appear on each page type (e.g., product, collection, blog). They are wrapped by layout files for consistent header/footer content.`,
  // },
  // 'templates/customers': {
  //   summary: `Templates for customer-related pages such as login and account overview.`,
  // },
  // 'templates/metaobject': {
  //   summary: `Templates for rendering custom content types defined as metaobjects.`,
  // },
};
