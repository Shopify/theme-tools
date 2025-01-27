import { LanguageModelChatMessage, TextEditor } from 'vscode';

export function buildMessages(textEditor: TextEditor) {
  const prompt = [
    basePrompt(textEditor),
    code(textEditor),
    codeMetadata(textEditor),
    liquidRules(),
    themeArchitectureContext(),
  ];

  return prompt.map((message) => LanguageModelChatMessage.User(message));
}

function basePrompt(textEditor: TextEditor): string {
  const numberOfSuggestions = textEditor.selection.isEmpty ? 5 : 1;

  return `
    <prompt>
        <instructions>
            <description>
                You are Shopify Magic, an AI assistant designed to help Liquid developers optimize Shopify themes.
            </description>
            <prompt_metadata>
                <type>Advanced Frontend Development Catalyst</type>
                <purpose>Enhanced Pattern Recognition with Liquid Expertise</purpose>
                <paradigm>Component-First Server-Side Rendering</paradigm>
                <constraints>Shopify Theme Architecture</constraints>
                <objective>Optimal Theme Development</objective>
            </prompt_metadata>
            <focus_areas>
                <area>Enhancing readability, conciseness, and efficiency while maintaining the same functionality</area>
                <area>Leveraging new features in Liquid, including filters, tags, and objects</area>
                <area>Be pragmatic and don't suggest without a really good reason</area>
                <area>Combine multiple operations into one (example, use the find filter instead of where and first) to improve readability and performance</area>
                <area>You should not suggest changes to the code that impact only HTML -- they should be focused on Liquid and Theme features.</area>
                <area>You should not talk about whitespaces and the style of the code; leave that to the linter!</area>
            </focus_areas>
            <ensurance>
                <point>The new code you propose contain full lines of valid code and keep the correct indentation, scope, and style format as the original code</point>
                <point>Scopes are defined by the opened by "{%", "{{" with the matching closing element "%}" or "}}"</point>
                <point>The range must include the closing element ("%}","}}") for every opening element ("{%","{{")</point>
                <point>Code suggestions cannot overlap in line numbers. If you have multiple suggestions for the same code chunk, merge them into a single suggestion</point>
                <point>Make full-scope suggestions that consider the entire context of the code you are modifying, keeping the logical scope of the code valid</point>
                <point>The resulting code must work and should not break existing HTML tags or Liquid syntax</point>
                <point>The suggestions are specific, actionable, and align with the best practices in Liquid and Shopify theme development</point>
                <point>Add a maximum of ${numberOfSuggestions} distinct suggestions to the array</point>
            </ensurance>
            <references>
                Use the <theme_architecture>, <liquid_rules>, and Shopify.dev context as a reference. Do not make up new information.
            </references>
            <pattern_recognition>
              ∀ solution ∈ theme: {
                identify_common_patterns();
                validate_liquid_syntax();
                abstract_reusable_components();
                establish_section_architecture();
                map_relationships(pattern, context);
                evaluate_effectiveness();

                if(pattern.frequency > threshold) {
                  create_reusable_snippet();
                  document_usage_patterns();
                }
              }
            </pattern_recognition>
            <context_evaluation>
              context = {
                platform_constraints,
                performance_requirements,
                accessibility_needs,
                user_experience_goals,
                maintenance_considerations,
                team_capabilities,
                project_timeline
              }

              for each decision_point:
                evaluate(context);
                adjust(implementation);
                validate(outcome);
                document_reasoning();
            </context_evaluation>
            <cognitive_framework>
              while(developing) {
                analyze_requirements();
                identify_patterns();
                validate_liquid_syntax();

                if(novel_approach_found()) {
                  validate_against_standards();
                  check_liquid_compatibility();
                  if(meets_criteria() && is_valid_liquid()) {
                    implement();
                    document_reasoning();
                  }
                }

                optimize_output();
                validate_accessibility();
                review_performance();
                combine_two_operations_into_one();
              }
            </cognitive_framework>
        </instructions>
        <response_format>
            <type>
                Your response must be exclusively a valid and parsable JSON object with the following structure schema:
            </type>
            <structure_schema>
                {
                  "$schema": {
                    "type": "object",
                    "properties": {
                      "reasonIfNoSuggestions": {
                        "type": ["string", "null"],
                        "description": "Explanation of why there are no suggestions"
                      },
                      "suggestions": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "newCode": {
                              "type": "string",
                              "description": "The improved code to replace the current code"
                            },
                            "range": {
                              "type": "object",
                              "properties": {
                                "start": {
                                  "type": "object",
                                  "properties": {
                                    "line": {
                                      "type": "number",
                                      "description": "Start line the new code starts"
                                    },
                                    "character": {
                                      "type": "number",
                                      "description": "Start character the new code starts"
                                    }
                                  }
                                },
                                "end": {
                                  "type": "object",
                                  "properties": {
                                    "line": {
                                      "type": "number",
                                      "description": "End line the new code ends"
                                    },
                                    "character": {
                                      "type": "number",
                                      "description": "End character the new code ends"
                                    }
                                  }
                                }
                              }
                            },
                            "line": {
                              "type": "number",
                              "description": "Line for the suggestion"
                            },
                            "suggestion": {
                              "type": "string",
                              "description": "Up to 60 chars explanation of the improvement and its benefits"
                            }
                          }
                        }
                      }
                    }
                  }
                }
            </structure_schema>
            <example>
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
            </example>
        </response_format>
    </prompt>
  `;
}

function themeArchitectureContext(): string {
  return `
    <theme_architecture>
      folder_structure = {
        ${Object.keys(THEME_ARCHITECTURE)
          .map((key) => `${key}: theme_${key}()`)
          .join(',\n        ')}
      }

    ${Object.entries(THEME_ARCHITECTURE)
      .map(
        ([key, value]) => `
        theme_${key} = {
          ${value.summary}
        }
      `,
      )
      .join('\n\n')}

      ∀ file ∈ theme:
        validate(file.location) ∈ folder_structure;

    </theme_architecture>
  `;
}

function code(textEditor: TextEditor) {
  const selection = textEditor.selection;
  const offset = selection.isEmpty ? 0 : selection.start.line;
  const text = textEditor.document.getText(selection.isEmpty ? undefined : selection);

  return `
<code>
${text
  .split('\n')
  .map((line, index) => `${index + 1 + offset}: ${line}`)
  .join('\n')}
</code>
`;
}

function codeMetadata(textEditor: TextEditor) {
  const fileName = textEditor.document.fileName;
  const fileType = getFileType(fileName);
  const fileTip = THEME_ARCHITECTURE[fileType]?.tip ?? 'this is a regular Liquid file';

  return `
    <code_metadata>
      - name: ${fileName},
      - type: ${fileType},
      - context: ${fileTip}
    </code_metadata>
  `;
}

function getFileType(path: string): string {
  const pathWithoutFile = path.substring(0, path.lastIndexOf('/'));
  const fileTypes = Object.keys(THEME_ARCHITECTURE);

  return fileTypes.find((type) => pathWithoutFile.endsWith(type)) || 'none';
}

function liquidRules() {
  return `
    <liquid_rules>
    valid_filters = [
      // Array manipulation
      { name: "find", usage: "array | find: string, string" },
      { name: "find_index", usage: "array | find_index: string, string" },
      { name: "reject", usage: "array | reject: string, string" },
      { name: "compact", usage: "array | compact" },
      { name: "concat", usage: "array | concat: array" },
      { name: "join", usage: "array | join" },
      { name: "last", usage: "array | last" },
      { name: "map", usage: "array | map: string" },
      { name: "reverse", usage: "array | reverse" },
      { name: "sort", usage: "array | sort" },
      { name: "sort_natural", usage: "array | sort_natural" },
      { name: "sum", usage: "array | sum" },
      { name: "uniq", usage: "array | uniq" },
      { name: "where", usage: "array | where: string, string" },
      { name: "first", usage: "array | first" },
      { name: "has", usage: "array | has: string, string" },

      // Collection/Product filters
      { name: "item_count_for_variant", usage: "cart | item_count_for_variant: {variant_id}" },
      { name: "line_items_for", usage: "cart | line_items_for: object" },
      { name: "class_list", usage: "settings.layout | class_list" },
      { name: "link_to_type", usage: "string | link_to_type" },
      { name: "link_to_vendor", usage: "string | link_to_vendor" },
      { name: "sort_by", usage: "string | sort_by: string" },
      { name: "url_for_type", usage: "string | url_for_type" },
      { name: "url_for_vendor", usage: "string | url_for_vendor" },
      { name: "within", usage: "string | within: collection" },

      // Color manipulation
      { name: "brightness_difference", usage: "string | brightness_difference: string" },
      { name: "color_brightness", usage: "string | color_brightness" },
      { name: "color_contrast", usage: "string | color_contrast: string" },
      { name: "color_darken", usage: "string | color_darken: number" },
      { name: "color_desaturate", usage: "string | color_desaturate: number" },
      { name: "color_difference", usage: "string | color_difference: string" },
      { name: "color_extract", usage: "string | color_extract: string" },
      { name: "color_lighten", usage: "string | color_lighten: number" },
      { name: "color_mix", usage: "string | color_mix: string, number" },
      { name: "color_modify", usage: "string | color_modify: string, number" },
      { name: "color_saturate", usage: "string | color_saturate: number" },
      { name: "color_to_hex", usage: "string | color_to_hex" },
      { name: "color_to_hsl", usage: "string | color_to_hsl" },
      { name: "color_to_rgb", usage: "string | color_to_rgb" },
      { name: "hex_to_rgba", usage: "string | hex_to_rgba" },

      // Cryptographic
      { name: "hmac_sha1", usage: "string | hmac_sha1: string" },
      { name: "hmac_sha256", usage: "string | hmac_sha256: string" },
      { name: "md5", usage: "string | md5" },
      { name: "sha1", usage: "string | sha1: string" },
      { name: "sha256", usage: "string | sha256: string" },

      // Customer/Store
      { name: "currency_selector", usage: "form | currency_selector" },
      { name: "customer_login_link", usage: "string | customer_login_link" },
      { name: "customer_logout_link", usage: "string | customer_logout_link" },
      { name: "customer_register_link", usage: "string | customer_register_link" },

      // Asset/Content
      { name: "date", usage: "string | date: string" },
      { name: "font_face", usage: "font | font_face" },
      { name: "font_modify", usage: "font | font_modify: string, string" },
      { name: "font_url", usage: "font | font_url" },
      { name: "default_errors", usage: "string | default_errors" },
      { name: "payment_button", usage: "form | payment_button" },
      { name: "payment_terms", usage: "form | payment_terms" },
      { name: "time_tag", usage: "string | time_tag: string" },
      { name: "translate", usage: "string | t" },
      { name: "inline_asset_content", usage: "asset_name | inline_asset_content" },

      // Data manipulation
      { name: "json", usage: "variable | json" },
      { name: "abs", usage: "number | abs" },
      { name: "append", usage: "string | append: string" },
      { name: "at_least", usage: "number | at_least" },
      { name: "at_most", usage: "number | at_most" },
      { name: "base64_decode", usage: "string | base64_decode" },
      { name: "base64_encode", usage: "string | base64_encode" },
      { name: "base64_url_safe_decode", usage: "string | base64_url_safe_decode" },
      { name: "base64_url_safe_encode", usage: "string | base64_url_safe_encode" },
      { name: "capitalize", usage: "string | capitalize" },
      { name: "ceil", usage: "number | ceil" },
      { name: "default", usage: "variable | default: variable" },
      { name: "divided_by", usage: "number | divided_by: number" },
      { name: "downcase", usage: "string | downcase" },
      { name: "escape", usage: "string | escape" },
      { name: "escape_once", usage: "string | escape_once" },
      { name: "floor", usage: "number | floor" },
      { name: "lstrip", usage: "string | lstrip" },
      { name: "minus", usage: "number | minus: number" },
      { name: "modulo", usage: "number | modulo: number" },
      { name: "newline_to_br", usage: "string | newline_to_br" },
      { name: "plus", usage: "number | plus: number" },
      { name: "prepend", usage: "string | prepend: string" },
      { name: "remove", usage: "string | remove: string" },
      { name: "remove_first", usage: "string | remove_first: string" },
      { name: "remove_last", usage: "string | remove_last: string" },
      { name: "replace", usage: "string | replace: string, string" },
      { name: "replace_first", usage: "string | replace_first: string, string" },
      { name: "replace_last", usage: "string | replace_last: string, string" },
      { name: "round", usage: "number | round" },
      { name: "rstrip", usage: "string | rstrip" },
      { name: "size", usage: "variable | size" },
      { name: "slice", usage: "string | slice" },
      { name: "split", usage: "string | split: string" },
      { name: "strip", usage: "string | strip" },
      { name: "strip_html", usage: "string | strip_html" },
      { name: "strip_newlines", usage: "string | strip_newlines" },
      { name: "times", usage: "number | times: number" },
      { name: "truncate", usage: "string | truncate: number" },
      { name: "truncatewords", usage: "string | truncatewords: number" },
      { name: "upcase", usage: "string | upcase" },
      { name: "url_decode", usage: "string | url_decode" },
      { name: "url_encode", usage: "string | url_encode" },

      // Media
      { name: "external_video_tag", usage: "variable | external_video_tag" },
      { name: "external_video_url", usage: "media | external_video_url: attribute: string" },
      { name: "image_tag", usage: "string | image_tag" },
      { name: "media_tag", usage: "media | media_tag" },
      { name: "model_viewer_tag", usage: "media | model_viewer_tag" },
      { name: "video_tag", usage: "media | video_tag" },
      { name: "metafield_tag", usage: "metafield | metafield_tag" },
      { name: "metafield_text", usage: "metafield | metafield_text" },

      // Money
      { name: "money", usage: "number | money" },
      { name: "money_with_currency", usage: "number | money_with_currency" },
      { name: "money_without_currency", usage: "number | money_without_currency" },
      { name: "money_without_trailing_zeros", usage: "number | money_without_trailing_zeros" },

      // UI/UX
      { name: "default_pagination", usage: "paginate | default_pagination" },
      { name: "avatar", usage: "customer | avatar" },
      { name: "login_button", usage: "shop | login_button" },
      { name: "camelize", usage: "string | camelize" },
      { name: "handleize", usage: "string | handleize" },
      { name: "url_escape", usage: "string | url_escape" },
      { name: "url_param_escape", usage: "string | url_param_escape" },
      { name: "structured_data", usage: "variable | structured_data" },

      // Navigation/Links
      { name: "highlight_active_tag", usage: "string | highlight_active_tag" },
      { name: "link_to_add_tag", usage: "string | link_to_add_tag" },
      { name: "link_to_remove_tag", usage: "string | link_to_remove_tag" },
      { name: "link_to_tag", usage: "string | link_to_tag" },

      // Formatting
      { name: "format_address", usage: "address | format_address" },
      { name: "highlight", usage: "string | highlight: string" },
      { name: "pluralize", usage: "number | pluralize: string, string" },

      // URLs and Assets
      { name: "article_img_url", usage: "variable | article_img_url" },
      { name: "asset_img_url", usage: "string | asset_img_url" },
      { name: "asset_url", usage: "string | asset_url" },
      { name: "collection_img_url", usage: "variable | collection_img_url" },
      { name: "file_img_url", usage: "string | file_img_url" },
      { name: "file_url", usage: "string | file_url" },
      { name: "global_asset_url", usage: "string | global_asset_url" },
      { name: "image_url", usage: "variable | image_url: width: number, height: number" },
      { name: "img_tag", usage: "string | img_tag" },
      { name: "img_url", usage: "variable | img_url" },
      { name: "link_to", usage: "string | link_to: string" },
      { name: "payment_type_img_url", usage: "string | payment_type_img_url" },
      { name: "payment_type_svg_tag", usage: "string | payment_type_svg_tag" },
      { name: "placeholder_svg_tag", usage: "string | placeholder_svg_tag" },
      { name: "preload_tag", usage: "string | preload_tag: as: string" },
      { name: "product_img_url", usage: "variable | product_img_url" },
      { name: "script_tag", usage: "string | script_tag" },
      { name: "shopify_asset_url", usage: "string | shopify_asset_url" },
      { name: "stylesheet_tag", usage: "string | stylesheet_tag" },
      { name: "weight_with_unit", usage: "number | weight_with_unit" }
    ]

    valid_tags = [
      // Content tags
      "content_for", "form", "layout",

      // Variable tags
      "assign", "capture", "increment", "decrement",

      // Control flow
      "if", "unless", "case", "when", "else", "elsif",

      // Iteration
      "for", "break", "continue", "cycle", "tablerow",

      // Output
      "echo", "raw",

      // Template
      "render", "include", "section", "sections",

      // Style/Script
      "javascript", "stylesheet", "style",

      // Utility
      "liquid", "comment", "paginate"
    ]

    valid_objects = [
      // Core objects
      "media", "address", "collections", "pages", "all_products", "app", "discount", "articles", "article", "block", "blogs", "blog", "brand", "cart", "collection",

      // Design/Theme
      "brand_color", "color", "color_scheme", "color_scheme_group", "theme", "settings", "template",

      // Business
      "company_address", "company", "company_location", "shop", "shop_locale", "policy",

      // Header/Layout
      "content_for_header", "content_for_layout",

      // Customer/Commerce
      "country", "currency", "customer", "discount_allocation", "discount_application",

      // Media
      "external_video", "image", "image_presentation", "images", "video", "video_source",

      // Navigation/Filtering
      "filter", "filter_value_display", "filter_value", "linklists", "linklist",

      // Loop controls
      "forloop", "tablerowloop",

      // Localization/Markets
      "localization", "location", "market",

      // Products/Variants
      "measurement", "product", "product_option", "product_option_value", "swatch", "variant", "quantity_price_break",

      // Metadata
      "metafield", "metaobject_definition", "metaobject", "metaobject_system",

      // Models/3D
      "model", "model_source",

      // Orders/Transactions
      "money", "order", "transaction", "transaction_payment_details",

      // Search/Recommendations
      "predictive_search", "recommendations", "search",

      // Selling plans
      "selling_plan_price_adjustment", "selling_plan_allocation", "selling_plan_allocation_price_adjustment", "selling_plan_checkout_charge", "selling_plan", "selling_plan_group", "selling_plan_group_option", "selling_plan_option",

      // Shipping/Availability
      "shipping_method", "store_availability",

      // System/Request
      "request", "robots", "routes", "script", "user", "user_agent",

      // Utilities
      "focal_point", "font", "form", "fulfillment", "generic_file", "gift_card", "line_item", "link", "page", "paginate", "rating", "recipient", "section", "tax_line", "taxonomy_category", "unit_price_measurement",

      // Additional features
      "additional_checkout_buttons", "all_country_option_tags", "canonical_url", "checkout", "comment", "content_for_additional_checkout_buttons", "content_for_index", "country_option_tags", "current_page", "current_tags", "form_errors", "handle", "page_description", "page_image", "page_title", "part", "pending_payment_instruction_input", "powered_by_link", "predictive_search_resources", "quantity_rule", "scripts", "sitemap", "sort_option"
    ]

    validation_rules = {
      syntax: {
        - Use {% liquid %} for multiline code
        - Use {% # comments %} for inline comments
        - Never invent new filters, tags, or objects
        - Follow proper tag closing order
        - Use proper object dot notation
        - Respect object scope and availability
      },

      theme_structure: {
        - Place files in appropriate directories
        - Follow naming conventions
        - Respect template hierarchy
        - Maintain proper section/block structure
        - Use appropriate schema settings
      }
    }

    ∀ liquid_code ∈ theme:
      validate_syntax(liquid_code) ∧
      validate_filters(liquid_code.filters ∈ valid_filters) ∧
      validate_tags(liquid_code.tags ∈ valid_tags) ∧
      validate_objects(liquid_code.objects ∈ valid_objects) ∧
      validate_structure(liquid_code.location ∈ theme_structure)
    </liquid_rules>
  `;
}

const THEME_ARCHITECTURE: { [key: string]: { summary: string; tip?: string } } = {
  sections: {
    summary: `
      - Liquid files that define customizable sections of a page
      - They include blocks and settings defined via a schema, allowing merchants to modify them in the theme editor
    `,
    tip: `
      - As sections grow in complexity, consider extracting reusable parts into snippets for better maintainability
      - Also look for opportunities to make components more flexible by moving hardcoded values into section settings that merchants can customize
    `,
  },
  blocks: {
    summary: `
      - Configurable elements within sections that can be added, removed, or reordered
      - They are defined with a schema tag for merchant customization in the theme editor
    `,
    tip: `
      - Break blocks into smaller, focused components that each do one thing well
      - Look for opportunities to extract repeated patterns into separate block types
      - Make blocks more flexible by moving hardcoded values into schema settings, but keep each block's schema simple and focused on its specific purpose
    `,
  },
  layout: {
    summary: `
      - Defines the structure for repeated content such as headers and footers, wrapping other template files
      - It's the frame that holds the page together, but it's not the content
    `,
    tip: `
      - Keep layouts focused on structural elements
      - Look for opportunities to extract components into sections
      - Headers, footers, navigation menus, and other reusable elements should be sections to enable merchant customization through the theme editor
    `,
  },
  snippets: {
    summary: `
      - Reusable code fragments included in templates, sections, and layouts via the render tag
      - Ideal for logic that needs to be reused but not directly edited in the theme editor
    `,
    tip: `
      - We must have a {% doc %} in snippets
      - Keep snippets focused on a single responsibility
      - Use variables to make snippets more reusable
      - Add a header comment block that documents expected inputs, dependencies, and any required objects/variables that need to be passed to the snippet
      <example>
        {% doc %}
          Renders loading-spinner.

          @param {string} foo - some foo
          @param {string} [bar] - optional bar

          @example
          {% render 'loading-spinner', foo: 'foo' %}
          {% render 'loading-spinner', foo: 'foo', bar: 'bar' %}
        {% enddoc %}
      </example>
    `,
  },
  config: {
    summary: `
      - Holds settings data and schema for theme customization options like typography and colors, accessible through the Admin theme editor.
    `,
  },
  assets: {
    summary: `
      - Contains static files such as CSS, JavaScript, and images. These assets can be referenced in Liquid files using the asset_url filter.
    `,
  },
  locales: {
    summary: `
      - Stores translation files for localizing theme editor and storefront content.
    `,
  },
  templates: {
    summary: `
      - JSON files that specify which sections appear on each page type (e.g., product, collection, blog).
      - They are wrapped by layout files for consistent header/footer content.
      - Templates can be Liquid files as well, but JSON is preferred as a good practice.
    `,
  },
  'templates/customers': {
    summary: `
      - Templates for customer-related pages such as login and account overview.
    `,
  },
  'templates/metaobject': {
    summary: `
      - Templates for rendering custom content types defined as metaobjects.
    `,
  },
};
