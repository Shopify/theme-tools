/**
 * ⚠️ This is a prototype implementation and not the final shape.
 *
 * The actual theme Liquid documentation context should be downloaded from
 * 👉 Shopify/theme-liquid-docs 👈 repository for production use.
 *
 * This placeholder is used for prototyping purposes only.
 */
export const themeLiquidDocs = {
  data: {
    filters: `
      // array
      { name: "compact", usage: "array | compact" },
      { name: "concat", usage: "array | concat: array" },
      { name: "find", usage: "array | find: string, string" },
      { name: "find_index", usage: "array | find_index: string, string" },
      { name: "first", usage: "array | first" },
      { name: "has", usage: "array | has: string, string" },
      { name: "join", usage: "array | join" },
      { name: "last", usage: "array | last" },
      { name: "map", usage: "array | map: string" },
      { name: "reject", usage: "array | reject: string, string" },
      { name: "reverse", usage: "array | reverse" },
      { name: "size", usage: "variable | size" },
      { name: "sort", usage: "array | sort" },
      { name: "sort_natural", usage: "array | sort_natural" },
      { name: "sum", usage: "array | sum" },
      { name: "uniq", usage: "array | uniq" },
      { name: "where", usage: "array | where: string, string" },

      // cart
      { name: "item_count_for_variant", usage: "cart | item_count_for_variant: {variant_id}" },
      { name: "line_items_for", usage: "cart | line_items_for: object" },

      // collection
      { name: "link_to_type", usage: "string | link_to_type" },
      { name: "link_to_vendor", usage: "string | link_to_vendor" },
      { name: "sort_by", usage: "string | sort_by: string" },
      { name: "url_for_type", usage: "string | url_for_type" },
      { name: "url_for_vendor", usage: "string | url_for_vendor" },
      { name: "within", usage: "string | within: collection" },
      { name: "highlight_active_tag", usage: "string | highlight_active_tag" },

      // color
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
      { name: "color_to_oklch", usage: "string | color_to_oklch" },
      { name: "color_to_rgb", usage: "string | color_to_rgb" },
      { name: "hex_to_rgba", usage: "string | hex_to_rgba" },

      // customer
      { name: "customer_login_link", usage: "string | customer_login_link" },
      { name: "customer_logout_link", usage: "string | customer_logout_link" },
      { name: "customer_register_link", usage: "string | customer_register_link" },
      { name: "avatar", usage: "customer | avatar" },
      { name: "login_button", usage: "shop | login_button" },

      // date
      { name: "date", usage: "date | date: string" },

      // default
      { name: "default_errors", usage: "string | default_errors" },
      { name: "default", usage: "variable | default: variable" },
      { name: "default_pagination", usage: "paginate | default_pagination" },

      // font
      { name: "font_face", usage: "font | font_face" },
      { name: "font_modify", usage: "font | font_modify: string, string" },
      { name: "font_url", usage: "font | font_url" },

      // format
      { name: "date", usage: "string | date: string" },
      { name: "json", usage: "variable | json" },
      { name: "structured_data", usage: "variable | structured_data" },
      { name: "unit_price_with_measurement", usage: "number | unit_price_with_measurement: unit_price_measurement" },
      { name: "weight_with_unit", usage: "number | weight_with_unit" },

      // hosted_file
      { name: "asset_img_url", usage: "string | asset_img_url" },
      { name: "asset_url", usage: "string | asset_url" },
      { name: "file_img_url", usage: "string | file_img_url" },
      { name: "file_url", usage: "string | file_url" },
      { name: "global_asset_url", usage: "string | global_asset_url" },
      { name: "shopify_asset_url", usage: "string | shopify_asset_url" },

      // html
      { name: "class_list", usage: "settings.layout | class_list" },
      { name: "time_tag", usage: "string | time_tag: string" },
      { name: "inline_asset_content", usage: "asset_name | inline_asset_content" },
      { name: "highlight", usage: "string | highlight: string" },
      { name: "link_to", usage: "string | link_to: string" },
      { name: "placeholder_svg_tag", usage: "string | placeholder_svg_tag" },
      { name: "preload_tag", usage: "string | preload_tag: as: string" },
      { name: "script_tag", usage: "string | script_tag" },
      { name: "stylesheet_tag", usage: "string | stylesheet_tag" },

      // localization
      { name: "currency_selector", usage: "form | currency_selector" },
      { name: "translate", usage: "string | t" },
      { name: "format_address", usage: "address | format_address" },

      // math
      { name: "abs", usage: "number | abs" },
      { name: "at_least", usage: "number | at_least" },
      { name: "at_most", usage: "number | at_most" },
      { name: "ceil", usage: "number | ceil" },
      { name: "divided_by", usage: "number | divided_by: number" },
      { name: "floor", usage: "number | floor" },
      { name: "minus", usage: "number | minus: number" },
      { name: "modulo", usage: "number | modulo: number" },
      { name: "plus", usage: "number | plus: number" },
      { name: "round", usage: "number | round" },
      { name: "times", usage: "number | times: number" },

      // media
      { name: "external_video_tag", usage: "variable | external_video_tag" },
      { name: "external_video_url", usage: "media | external_video_url: attribute: string" },
      { name: "image_tag", usage: "string | image_tag" },
      { name: "media_tag", usage: "media | media_tag" },
      { name: "model_viewer_tag", usage: "media | model_viewer_tag" },
      { name: "video_tag", usage: "media | video_tag" },
      { name: "article_img_url", usage: "variable | article_img_url" },
      { name: "collection_img_url", usage: "variable | collection_img_url" },
      { name: "image_url", usage: "variable | image_url: width: number, height: number" },
      { name: "img_tag", usage: "string | img_tag" },
      { name: "img_url", usage: "variable | img_url" },
      { name: "product_img_url", usage: "variable | product_img_url" },

      // metafield
      { name: "metafield_tag", usage: "metafield | metafield_tag" },
      { name: "metafield_text", usage: "metafield | metafield_text" },

      // money
      { name: "money", usage: "number | money" },
      { name: "money_with_currency", usage: "number | money_with_currency" },
      { name: "money_without_currency", usage: "number | money_without_currency" },
      { name: "money_without_trailing_zeros", usage: "number | money_without_trailing_zeros" },

      // payment
      { name: "payment_button", usage: "form | payment_button" },
      { name: "payment_terms", usage: "form | payment_terms" },
      { name: "payment_type_img_url", usage: "string | payment_type_img_url" },
      { name: "payment_type_svg_tag", usage: "string | payment_type_svg_tag" },

      // string
      { name: "hmac_sha1", usage: "string | hmac_sha1: string" },
      { name: "hmac_sha256", usage: "string | hmac_sha256: string" },
      { name: "md5", usage: "string | md5" },
      { name: "sha1", usage: "string | sha1: string" },
      { name: "sha256", usage: "string | sha256: string" },
      { name: "append", usage: "string | append: string" },
      { name: "base64_decode", usage: "string | base64_decode" },
      { name: "base64_encode", usage: "string | base64_encode" },
      { name: "base64_url_safe_decode", usage: "string | base64_url_safe_decode" },
      { name: "base64_url_safe_encode", usage: "string | base64_url_safe_encode" },
      { name: "capitalize", usage: "string | capitalize" },
      { name: "downcase", usage: "string | downcase" },
      { name: "escape", usage: "string | escape" },
      { name: "escape_once", usage: "string | escape_once" },
      { name: "lstrip", usage: "string | lstrip" },
      { name: "newline_to_br", usage: "string | newline_to_br" },
      { name: "prepend", usage: "string | prepend: string" },
      { name: "remove", usage: "string | remove: string" },
      { name: "remove_first", usage: "string | remove_first: string" },
      { name: "remove_last", usage: "string | remove_last: string" },
      { name: "replace", usage: "string | replace: string, string" },
      { name: "replace_first", usage: "string | replace_first: string, string" },
      { name: "replace_last", usage: "string | replace_last: string, string" },
      { name: "rstrip", usage: "string | rstrip" },
      { name: "slice", usage: "string | slice" },
      { name: "split", usage: "string | split: string" },
      { name: "strip", usage: "string | strip" },
      { name: "strip_html", usage: "string | strip_html" },
      { name: "strip_newlines", usage: "string | strip_newlines" },
      { name: "truncate", usage: "string | truncate: number" },
      { name: "truncatewords", usage: "string | truncatewords: number" },
      { name: "upcase", usage: "string | upcase" },
      { name: "url_decode", usage: "string | url_decode" },
      { name: "url_encode", usage: "string | url_encode" },
      { name: "camelize", usage: "string | camelize" },
      { name: "handleize", usage: "string | handleize" },
      { name: "url_escape", usage: "string | url_escape" },
      { name: "url_param_escape", usage: "string | url_param_escape" },
      { name: "pluralize", usage: "number | pluralize: string, string" },

      // tag
      { name: "link_to_add_tag", usage: "string | link_to_add_tag" },
      { name: "link_to_remove_tag", usage: "string | link_to_remove_tag" },
      { name: "link_to_tag", usage: "string | link_to_tag" },
    `,
    tags: `
      content_for,
      form,
      layout,
      assign,
      break,
      capture,
      case,
      comment,
      continue,
      cycle,
      decrement,
      doc,
      echo,
      for,
      if,
      include,
      increment,
      raw,
      render,
      tablerow,
      unless,
      paginate,
      javascript,
      section,
      stylesheet,
      sections,
      style,
      else,
      else,
      liquid,
    `,
    objects: `
      collections,
      pages,
      all_products,
      articles,
      blogs,
      cart,
      closest,
      content_for_header,
      customer,
      images,
      linklists,
      localization,
      metaobjects,
      request,
      routes,
      shop,
      theme,
      settings,
      template,
      additional_checkout_buttons,
      all_country_option_tags,
      canonical_url,
      content_for_additional_checkout_buttons,
      content_for_index,
      content_for_layout,
      country_option_tags,
      current_page,
      handle,
      page_description,
      page_image,
      page_title,
      powered_by_link,
      scripts,
    `,
  },
  ai: {
    themeArchitecture: {
      sections: `
        - Liquid files that define customizable sections of a page
        - They include blocks and settings defined via a schema, allowing merchants to modify them in the theme editor
        - Should occupy the full width of the page container and be self-contained layout units
        - Can be added to any JSON template and reordered via the theme editor
        - Must include a {% schema %} tag to define settings and presets
        - Examples: hero banners, product grids, testimonials, featured collections
        - Use {% stylesheet %} to include styles for the section
      `,
      snippets: `
        - Reusable code fragments included in templates, sections, and layouts via the render tag
        - Ideal for logic that needs to be reused but not directly edited in the theme editor
        - Can accept parameters when rendered for dynamic behavior
        - Perfect for repetitive UI components like product cards, buttons, or form elements
        - Help maintain DRY (Don't Repeat Yourself) principles in theme development
        - Examples: product-card.liquid, icon.liquid, price.liquid
        - Use the {% stylesheet %} tag to include styles for the snippet
        - Use the {% doc %} tag in the header of the snippet to document, example:
          {% doc %}
            Renders a responsive image that might be wrapped in a link.

            @param {image} image - The image to be rendered
            @param {string} [url] - An optional destination URL for the image

            @example
            {% render 'image', image: product.featured_image %}
          {% enddoc %}
      `,
      blocks: `
        - Liquid content for the block must live in a snippet rendereed in the block file that just exposes the schema for that snippet
        - Configurable elements within sections that can be added, removed, or reordered
        - They are defined with a schema tag for merchant customization in the theme editor
        - Allow merchants to build dynamic content without code changes
        - Each block has a type and can contain settings for text, images, groups, links, etc.
        - Limited to specific block types defined in the section's schema
        - Blocks can be nested within other blocks to create hierarchical content structures
        - Examples: individual testimonials, slides in a carousel, feature items
        - Use {% stylesheet %} to include styles for the block (but they should likely be in the snippet)
        - Do not use {% doc %} tag in the block file (only if you render it directly in other file with content_for)
      `,
    },
  },
};
