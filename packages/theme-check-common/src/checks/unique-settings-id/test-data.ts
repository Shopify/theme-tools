export const invalidJson = `
[
  {
    "name": "theme_info",
    "theme_name": "SKKN",
    "theme_author": "Accenture",
    "theme_version": "2.0.0",
    "theme_documentation_url": "https://www.accenture.com/",
    "theme_support_url": "https://www.accenture.com/"
  },
  {
    "name": "Colors",
    "settings": [
      {
        "type": "color",
        "id": "theme_color",
        "label": "Theme Primary Color",
        "default": "#ff0000"
      },
      {
        "type": "color",
        "id": "default_shade_color",
        "label": "PDP default shade option",
        "default": "#757575"
      }
    ]
  },
  {
    "name": "Logos",
    "settings": [
      {
        "type": "image_picker",
        "id": "logo",
        "label": "Logo image"
      }
    ]
  },
  {
    "name": "Favicon",
    "settings": [
      {
        "type": "image_picker",
        "id": "favicon",
        "label": "Favicon image",
        "info": "Will be scaled down to 32 x 32px"
      }
    ]
  },
  {
    "name": "Social media",
    "settings": [
      {
        "type": "header",
        "content": "Social sharing options"
      },
      {
        "type": "checkbox",
        "id": "share_facebook",
        "label": "Share on Facebook",
        "default": true
      },
      {
        "type": "checkbox",
        "id": "share_twitter",
        "label": "Tweet on Twitter",
        "default": true
      },
      {
        "type": "checkbox",
        "id": "share_pinterest",
        "label": "Pin on Pinterest",
        "default": true
      },
      {
        "type": "header",
        "content": "Social accounts"
      },
      {
        "type": "text",
        "id": "social_twitter_link",
        "label": "Twitter",
        "info": "https://twitter.com/shopify"
      },
      {
        "type": "text",
        "id": "social_facebook_link",
        "label": "Facebook",
        "info": "https://facebook.com/shopify"
      },
      {
        "type": "text",
        "id": "social_pinterest_link",
        "label": "Pinterest",
        "info": "https://pinterest.com/shopify"
      },
      {
        "type": "text",
        "id": "social_instagram_link",
        "label": "Instagram",
        "info": "http://instagram.com/shopify"
      },
      {
        "type": "text",
        "id": "social_tiktok_link",
        "label": "TikTok",
        "info": "http://tiktok.com/shopify"
      },
      {
        "type": "text",
        "id": "social_tumblr_link",
        "label": "Tumblr",
        "info": "http://shopify.tumblr.com"
      },
      {
        "type": "text",
        "id": "social_snapchat_link",
        "label": "Snapchat",
        "info": "https://www.snapchat.com/add/shopify"
      },
      {
        "type": "text",
        "id": "social_youtube_link",
        "label": "YouTube",
        "info": "https://www.youtube.com/shopify"
      },
      {
        "type": "text",
        "id": "social_vimeo_link",
        "label": "Vimeo",
        "info": "https://vimeo.com/shopify"
      }
    ]
  },
  {
    "name": "Newsletter",
    "settings": [
      {
        "type": "header",
        "content": "Attentive"
      },
      {
        "type": "text",
        "id": "attentive_id_desktop",
        "label": "Creative ID (Desktop)"
      },
      {
        "type": "text",
        "id": "attentive_id_mobile",
        "label": "Creative ID (Mobile)"
      },
      {
        "type": "richtext",
        "id": "privacy_policy",
        "label": "Content"
      }
    ]
  },
  {
    "name": "Nosto Account Id",
    "settings": [
      {
        "type": "text",
        "id": "nosto_account_id",
        "label": "Nosto account id",
        "default": "shopify-62406787286",
        "placeholder": "If empty, Nosto script won't load"
      }
    ]
  },
  {
    "name": "Image Sizes",
    "settings": [
      {
        "type": "range",
        "id": "product_gallery_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Product Gallery",
        "default": 800
      },
      {
        "type": "range",
        "id": "product_tile_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Product Tile",
        "default": 800
      },
      {
        "type": "range",
        "id": "article_tile_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Article Tile",
        "default": 800
      },
      {
        "type": "range",
        "id": "collection_tile_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Collection Tile",
        "default": 800
      },
      {
        "type": "range",
        "id": "line_item_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Line Item Thumbnail",
        "default": 400
      },
      {
        "type": "text",
        "id": "responsive_sizes",
        "label": "Responsive Sized",
        "default": "360,540,720,900,1080,1200,1440,1680,1920",
        "info": "Comma-separated list of sizes"
      }
    ]
  },
  {
    "name": "Pagination",
    "settings": [
      {
        "type": "range",
        "id": "products_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Collection Products",
        "default": 12
      },
      {
        "type": "range",
        "id": "results_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Search Results",
        "default": 12
      },
      {
        "type": "range",
        "id": "articles_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Blog Articles",
        "default": 12
      },
      {
        "type": "range",
        "id": "comments_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Article Comments",
        "default": 12
      },
      {
        "type": "range",
        "id": "addresses_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Customer Addresses",
        "default": 12
      },
      {
        "type": "range",
        "id": "orders_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Customer Orders",
        "default": 12
      }
    ]
  },
  {
    "name": "Navigation",
    "settings": [
      {
        "type": "header",
        "content": "Breadcrumbs"
      },
      {
        "type": "checkbox",
        "id": "show_breadcrumbs_home",
        "label": "Show Home link",
        "default": true
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_page",
        "label": "Enable on Page template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_product",
        "label": "Enable on Product template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_collection",
        "label": "Enable on Collection template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_blog",
        "label": "Enable on Blog template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_article",
        "label": "Enable on Article template",
        "default": false
      },
      {
        "type": "text",
        "id": "footer_handle",
        "label": "Footer Handle"
      },
      {
        "type": "text",
        "id": "checkout_footer_handle",
        "label": "Checkout Footer Handle"
      }
    ]
  },
  {
    "name": "Nosto Account Id",
    "settings": [
      {
        "type": "text",
        "id": "nosto_account_id",
        "label": "Nosto account id",
        "default": "shopify-62406787286",
        "placeholder": "If empty, Nosto script won't load"
      }
    ]
  },
  {
    "name": "Loyalty",
    "settings": [
      {
        "type": "range",
        "id": "loyalty_points_settingss",
        "min": 0,
        "max": 10,
        "step": 0.5,
        "label": "Loyalty Points",
        "default": 0.5
      }
    ]
  },
  {
    "name": "Cart",
    "settings": [
      {
        "type": "range",
        "id": "free_shipping_threshold",
        "min": 0,
        "max": 150,
        "step": 5,
        "unit": "$",
        "label": "Free Shipping Threshold",
        "default": 75
      },
      {
        "type": "product",
        "id": "complete_collection_set_handle",
        "label": "Complete Collection Set Handle"
      },
      {
        "type": "text",
        "id": "complete_collection_set_text",
        "label": "Complete Collection Set Message",
        "default": "You’re receiving 5 complimentary samples with your purchase of The Complete Collection."
      },
      {
        "type": "text",
        "id": "quantity_message_for_one_time_purchase",
        "label": "Quantity Message For Onetime Purchase",
        "default": "You can select a maximum of 10 products of this item per order"
      },
      {
        "type": "text",
        "id": "quantity_message_for_subscription",
        "label": "Quantity Message For Subscription",
        "default": "You can select a maximum of 3 products of this item per order"
      },
      {
        "type": "number",
        "id": "maximum_quantity_for_one_time_purchase",
        "label": "Maximum Quantity For Onetime Purchase",
        "default": 10
      },
      {
        "type": "number",
        "id": "maximum_quantity_for_subscription",
        "label": "Maximum Quantity For Subscription",
        "default": 3
      }
    ]
  },
  {
    "name": "Global-E",
    "settings": [
      {
        "type": "checkbox",
        "id": "enable_globale",
        "label": "Enable Global-E",
        "default": true
      },
      {
        "type": "select",
        "id": "environment",
        "label": "Environment",
        "options": [
          {
            "value": "INT",
            "label": "Staging"
          },
          {
            "value": "PROD",
            "label": "Production"
          }
        ],
        "default": "INT"
      },
      {
        "type": "text",
        "id": "globale_mid",
        "label": "Global-E Merchant ID",
        "default": "1164"
      },
      {
        "type": "text",
        "id": "globale_emi",
        "label": "Global-E EMI",
        "default": "8uyw"
      },
      {
        "type": "text",
        "id": "globale_site_id",
        "label": "Global-E Site ID",
        "default": "212b00eaaa7c"
      },
      {
        "type": "text",
        "id": "globale_appurl",
        "label": "Global-E App URL",
        "default": "https://crossborder-integration-qa-int.bglobale.com/"
      },
      {
        "type": "text",
        "id": "globale_geappurl",
        "label": "Global-E GE App URL",
        "default": "https://www.bglobale.com/"
      },
      {
        "type": "text",
        "id": "globale_apiurl",
        "label": "Global-E GE API URL",
        "default": "https://connect.bglobale.com/"
      },
      {
        "type": "text",
        "id": "globale_checkout_environment",
        "label": "Global-E Checkout Environment ID",
        "default": "www.bglobale.com"
      },
      {
        "type": "text",
        "id": "globale_operated_countries_GLBE_PARAMS",
        "label": "Operated Countries (GLBE_PARAMS)",
        "info": "Please enter a comma separated list with no spaces, ex: AT,BE,BE,BG",
        "default": "AD, AE, AT, BE, BG, BN, CA, CH, CN, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GL, GR, HR, HU, ID, IE, IS, IT, LT, LU, LV, MC, MT, MX, NL, NO, PL, PT, RO, SA, SE, SG, SI, SK, VA"
      },
      {
        "type": "text",
        "id": "globale_operated_countries_outside_GLBE_PARAMS",
        "label": "Operated Countries outside GLBE_PARAMS",
        "info": "Please enter a comma separated list with no spaces, ex: AT,BE,BE,BG",
        "default": "AD,AE,AT,BE,BG,BN,CA,CH,CN,CY,CZ,DE,DK,EE,ES,FI,FR,GB,GL,GR,HR,HU,ID,IE,IS,IT,LT,LU,LV,MC,MT,MX,NL,NO,PL,PT,RO,SA,SE,SG,SI,SK,VA"
      }
    ]
  },
  {
    "name": "Checkout Killswitches",
    "settings": [
      {
        "type": "checkbox",
        "id": "terms_of_service_checkout",
        "label": "Enables Terms of Service at Checkout Payment Method Step"
      }
    ]
  },
  {
    "name": "Hide Discount Code",
    "settings": [
      {
        "type": "text",
        "id": "bundle_not_eligible_for_welcome10_discount",
        "label": "Display below message as WELCOME10 is Not eligible for Bundle Items",
        "default": "Part of Bundle, Not eligible for discount"
      },
      {
        "type": "text",
        "id": "tiered_off_promotion_code",
        "label": "Tiered % Off promotion Code (should be exact) or leave it empty if there is no tiered % off promotion active",
        "default": "TIEREDOFF"
      }
    ]
  },
  {
    "name": "Klaviyo - Back In Stock",
    "settings": [
      {
        "type": "text",
        "id": "klaviyo_public_api_key",
        "label": "public Klaviyo API Key",
        "default": "UJ6swp"
      },
      {
        "type": "text",
        "id": "listId",
        "label": "list id",
        "default": "S8qDcW"
      }
    ]
  },
  {
    "name": "Sample",
    "settings": [
      {
        "type": "text",
        "id": "sample_message",
        "label": "Display below message as when customer order again for sample"
      },
      {
        "type": "header",
        "content": "Attentive Popup for Product Page"
      },
      {
        "type": "text",
        "id": "attentive_id_desktop_sample",
        "label": "Creative ID (Desktop)"
      },
      {
        "type": "text",
        "id": "attentive_id_mobile_sample",
        "label": "Creative ID (Mobile)"
      }
    ]
  },
  {
    "name": "Yotpo",
    "settings": [
      {
        "type": "header",
        "content": "Yotpo - Checkout Redeem Points"
      },
      {
        "type": "text",
        "id": "yotpo_checkout_widget_id",
        "label": "Yotpo Checkout Widget ID",
        "default": "JXB__Dq8om7IRNIBU7D8ag"
      },
      {
        "type": "text",
        "id": "yotpo_checkout_instance_id",
        "label": "Yotpo Checkout Instance ID",
        "default": "472279"
      },
      {
        "type": "text",
        "id": "yotpo_account_text",
        "label": "Yotpo Account Text",
        "default": "Apply your points at checkout to receive a discount on your purchase"
      }
    ]
  }
]`;

export const validJson = `
[
  {
    "name": "theme_info",
    "theme_name": "SKKN",
    "theme_author": "Accenture",
    "theme_version": "2.0.0",
    "theme_documentation_url": "https://www.accenture.com/",
    "theme_support_url": "https://www.accenture.com/"
  },
  {
    "name": "Colors",
    "settings": [
      {
        "type": "color",
        "id": "theme_color",
        "label": "Theme Primary Color",
        "default": "#ff0000"
      },
      {
        "type": "color",
        "id": "default_shade_color",
        "label": "PDP default shade option",
        "default": "#757575"
      }
    ]
  },
  {
    "name": "Logos",
    "settings": [
      {
        "type": "image_picker",
        "id": "logo",
        "label": "Logo image"
      }
    ]
  },
  {
    "name": "Favicon",
    "settings": [
      {
        "type": "image_picker",
        "id": "favicon",
        "label": "Favicon image",
        "info": "Will be scaled down to 32 x 32px"
      }
    ]
  },
  {
    "name": "Social media",
    "settings": [
      {
        "type": "header",
        "content": "Social sharing options"
      },
      {
        "type": "checkbox",
        "id": "share_facebook",
        "label": "Share on Facebook",
        "default": true
      },
      {
        "type": "checkbox",
        "id": "share_twitter",
        "label": "Tweet on Twitter",
        "default": true
      },
      {
        "type": "checkbox",
        "id": "share_pinterest",
        "label": "Pin on Pinterest",
        "default": true
      },
      {
        "type": "header",
        "content": "Social accounts"
      },
      {
        "type": "text",
        "id": "social_twitter_link",
        "label": "Twitter",
        "info": "https://twitter.com/shopify"
      },
      {
        "type": "text",
        "id": "social_facebook_link",
        "label": "Facebook",
        "info": "https://facebook.com/shopify"
      },
      {
        "type": "text",
        "id": "social_pinterest_link",
        "label": "Pinterest",
        "info": "https://pinterest.com/shopify"
      },
      {
        "type": "text",
        "id": "social_instagram_link",
        "label": "Instagram",
        "info": "http://instagram.com/shopify"
      },
      {
        "type": "text",
        "id": "social_tiktok_link",
        "label": "TikTok",
        "info": "http://tiktok.com/shopify"
      },
      {
        "type": "text",
        "id": "social_tumblr_link",
        "label": "Tumblr",
        "info": "http://shopify.tumblr.com"
      },
      {
        "type": "text",
        "id": "social_snapchat_link",
        "label": "Snapchat",
        "info": "https://www.snapchat.com/add/shopify"
      },
      {
        "type": "text",
        "id": "social_youtube_link",
        "label": "YouTube",
        "info": "https://www.youtube.com/shopify"
      },
      {
        "type": "text",
        "id": "social_vimeo_link",
        "label": "Vimeo",
        "info": "https://vimeo.com/shopify"
      }
    ]
  },
  {
    "name": "Newsletter",
    "settings": [
      {
        "type": "header",
        "content": "Attentive"
      },
      {
        "type": "text",
        "id": "attentive_id_desktop",
        "label": "Creative ID (Desktop)"
      },
      {
        "type": "text",
        "id": "attentive_id_mobile",
        "label": "Creative ID (Mobile)"
      },
      {
        "type": "richtext",
        "id": "privacy_policy",
        "label": "Content"
      }
    ]
  },
  {
    "name": "Nosto Account Id",
    "settings": [
      {
        "type": "text",
        "id": "nosto_account_id",
        "label": "Nosto account id",
        "default": "shopify-62406787286",
        "placeholder": "If empty, Nosto script won't load"
      }
    ]
  },
  {
    "name": "Image Sizes",
    "settings": [
      {
        "type": "range",
        "id": "product_gallery_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Product Gallery",
        "default": 800
      },
      {
        "type": "range",
        "id": "product_tile_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Product Tile",
        "default": 800
      },
      {
        "type": "range",
        "id": "article_tile_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Article Tile",
        "default": 800
      },
      {
        "type": "range",
        "id": "collection_tile_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Collection Tile",
        "default": 800
      },
      {
        "type": "range",
        "id": "line_item_image_max",
        "min": 160,
        "max": 1920,
        "step": 40,
        "label": "Line Item Thumbnail",
        "default": 400
      },
      {
        "type": "text",
        "id": "responsive_sizes",
        "label": "Responsive Sized",
        "default": "360,540,720,900,1080,1200,1440,1680,1920",
        "info": "Comma-separated list of sizes"
      }
    ]
  },
  {
    "name": "Pagination",
    "settings": [
      {
        "type": "range",
        "id": "products_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Collection Products",
        "default": 12
      },
      {
        "type": "range",
        "id": "results_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Search Results",
        "default": 12
      },
      {
        "type": "range",
        "id": "articles_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Blog Articles",
        "default": 12
      },
      {
        "type": "range",
        "id": "comments_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Article Comments",
        "default": 12
      },
      {
        "type": "range",
        "id": "addresses_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Customer Addresses",
        "default": 12
      },
      {
        "type": "range",
        "id": "orders_page_size",
        "min": 4,
        "max": 48,
        "step": 1,
        "label": "Customer Orders",
        "default": 12
      }
    ]
  },
  {
    "name": "Navigation",
    "settings": [
      {
        "type": "header",
        "content": "Breadcrumbs"
      },
      {
        "type": "checkbox",
        "id": "show_breadcrumbs_home",
        "label": "Show Home link",
        "default": true
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_page",
        "label": "Enable on Page template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_product",
        "label": "Enable on Product template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_collection",
        "label": "Enable on Collection template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_blog",
        "label": "Enable on Blog template",
        "default": false
      },
      {
        "type": "checkbox",
        "id": "enable_breadcrumbs_article",
        "label": "Enable on Article template",
        "default": false
      },
      {
        "type": "text",
        "id": "footer_handle",
        "label": "Footer Handle"
      },
      {
        "type": "text",
        "id": "checkout_footer_handle",
        "label": "Checkout Footer Handle"
      }
    ]
  },
  {
    "name": "Nosto Account Id",
    "settings": [
      {
        "type": "text",
        "id": "nosto_account_id_fixed",
        "label": "Nosto account id",
        "default": "shopify-62406787286",
        "placeholder": "If empty, Nosto script won't load"
      }
    ]
  },
  {
    "name": "Loyalty",
    "settings": [
      {
        "type": "range",
        "id": "loyalty_points_settingss",
        "min": 0,
        "max": 10,
        "step": 0.5,
        "label": "Loyalty Points",
        "default": 0.5
      }
    ]
  },
  {
    "name": "Cart",
    "settings": [
      {
        "type": "range",
        "id": "free_shipping_threshold",
        "min": 0,
        "max": 150,
        "step": 5,
        "unit": "$",
        "label": "Free Shipping Threshold",
        "default": 75
      },
      {
        "type": "product",
        "id": "complete_collection_set_handle",
        "label": "Complete Collection Set Handle"
      },
      {
        "type": "text",
        "id": "complete_collection_set_text",
        "label": "Complete Collection Set Message",
        "default": "You’re receiving 5 complimentary samples with your purchase of The Complete Collection."
      },
      {
        "type": "text",
        "id": "quantity_message_for_one_time_purchase",
        "label": "Quantity Message For Onetime Purchase",
        "default": "You can select a maximum of 10 products of this item per order"
      },
      {
        "type": "text",
        "id": "quantity_message_for_subscription",
        "label": "Quantity Message For Subscription",
        "default": "You can select a maximum of 3 products of this item per order"
      },
      {
        "type": "number",
        "id": "maximum_quantity_for_one_time_purchase",
        "label": "Maximum Quantity For Onetime Purchase",
        "default": 10
      },
      {
        "type": "number",
        "id": "maximum_quantity_for_subscription",
        "label": "Maximum Quantity For Subscription",
        "default": 3
      }
    ]
  },
  {
    "name": "Global-E",
    "settings": [
      {
        "type": "checkbox",
        "id": "enable_globale",
        "label": "Enable Global-E",
        "default": true
      },
      {
        "type": "select",
        "id": "environment",
        "label": "Environment",
        "options": [
          {
            "value": "INT",
            "label": "Staging"
          },
          {
            "value": "PROD",
            "label": "Production"
          }
        ],
        "default": "INT"
      },
      {
        "type": "text",
        "id": "globale_mid",
        "label": "Global-E Merchant ID",
        "default": "1164"
      },
      {
        "type": "text",
        "id": "globale_emi",
        "label": "Global-E EMI",
        "default": "8uyw"
      },
      {
        "type": "text",
        "id": "globale_site_id",
        "label": "Global-E Site ID",
        "default": "212b00eaaa7c"
      },
      {
        "type": "text",
        "id": "globale_appurl",
        "label": "Global-E App URL",
        "default": "https://crossborder-integration-qa-int.bglobale.com/"
      },
      {
        "type": "text",
        "id": "globale_geappurl",
        "label": "Global-E GE App URL",
        "default": "https://www.bglobale.com/"
      },
      {
        "type": "text",
        "id": "globale_apiurl",
        "label": "Global-E GE API URL",
        "default": "https://connect.bglobale.com/"
      },
      {
        "type": "text",
        "id": "globale_checkout_environment",
        "label": "Global-E Checkout Environment ID",
        "default": "www.bglobale.com"
      },
      {
        "type": "text",
        "id": "globale_operated_countries_GLBE_PARAMS",
        "label": "Operated Countries (GLBE_PARAMS)",
        "info": "Please enter a comma separated list with no spaces, ex: AT,BE,BE,BG",
        "default": "AD, AE, AT, BE, BG, BN, CA, CH, CN, CY, CZ, DE, DK, EE, ES, FI, FR, GB, GL, GR, HR, HU, ID, IE, IS, IT, LT, LU, LV, MC, MT, MX, NL, NO, PL, PT, RO, SA, SE, SG, SI, SK, VA"
      },
      {
        "type": "text",
        "id": "globale_operated_countries_outside_GLBE_PARAMS",
        "label": "Operated Countries outside GLBE_PARAMS",
        "info": "Please enter a comma separated list with no spaces, ex: AT,BE,BE,BG",
        "default": "AD,AE,AT,BE,BG,BN,CA,CH,CN,CY,CZ,DE,DK,EE,ES,FI,FR,GB,GL,GR,HR,HU,ID,IE,IS,IT,LT,LU,LV,MC,MT,MX,NL,NO,PL,PT,RO,SA,SE,SG,SI,SK,VA"
      }
    ]
  },
  {
    "name": "Checkout Killswitches",
    "settings": [
      {
        "type": "checkbox",
        "id": "terms_of_service_checkout",
        "label": "Enables Terms of Service at Checkout Payment Method Step"
      }
    ]
  },
  {
    "name": "Hide Discount Code",
    "settings": [
      {
        "type": "text",
        "id": "bundle_not_eligible_for_welcome10_discount",
        "label": "Display below message as WELCOME10 is Not eligible for Bundle Items",
        "default": "Part of Bundle, Not eligible for discount"
      },
      {
        "type": "text",
        "id": "tiered_off_promotion_code",
        "label": "Tiered % Off promotion Code (should be exact) or leave it empty if there is no tiered % off promotion active",
        "default": "TIEREDOFF"
      }
    ]
  },
  {
    "name": "Klaviyo - Back In Stock",
    "settings": [
      {
        "type": "text",
        "id": "klaviyo_public_api_key",
        "label": "public Klaviyo API Key",
        "default": "UJ6swp"
      },
      {
        "type": "text",
        "id": "listId",
        "label": "list id",
        "default": "S8qDcW"
      }
    ]
  },
  {
    "name": "Sample",
    "settings": [
      {
        "type": "text",
        "id": "sample_message",
        "label": "Display below message as when customer order again for sample"
      },
      {
        "type": "header",
        "content": "Attentive Popup for Product Page"
      },
      {
        "type": "text",
        "id": "attentive_id_desktop_sample",
        "label": "Creative ID (Desktop)"
      },
      {
        "type": "text",
        "id": "attentive_id_mobile_sample",
        "label": "Creative ID (Mobile)"
      }
    ]
  },
  {
    "name": "Yotpo",
    "settings": [
      {
        "type": "header",
        "content": "Yotpo - Checkout Redeem Points"
      },
      {
        "type": "text",
        "id": "yotpo_checkout_widget_id",
        "label": "Yotpo Checkout Widget ID",
        "default": "JXB__Dq8om7IRNIBU7D8ag"
      },
      {
        "type": "text",
        "id": "yotpo_checkout_instance_id",
        "label": "Yotpo Checkout Instance ID",
        "default": "472279"
      },
      {
        "type": "text",
        "id": "yotpo_account_text",
        "label": "Yotpo Account Text",
        "default": "Apply your points at checkout to receive a discount on your purchase"
      }
    ]
  }
]`;
