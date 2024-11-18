export declare namespace Setting {
  /** Setting values are  */
  export type Values = Record<string, string | number | boolean | string[]>;

  /** Union type of all setting types */
  export type Any = InputSetting | SideBarSetting;

  /** Settings used for display */
  export type SideBarSetting = Header | Paragraph;

  /** Settings with data */
  export type InputSetting =
    | Article
    | Blog
    | Collection
    | Page
    | Product
    | CollectionList
    | ProductList
    | MetaobjectList
    | Text
    | Textarea
    | Richtext
    | InlineRichtext
    | Html
    | Url
    | TextAlignment
    | Number
    | Range
    | Checkbox
    | Radio
    | Select
    | Color
    | ColorBackground
    | ColorScheme
    | ColorSchemeGroup
    | ImagePicker
    | Video
    | VideoUrl
    | FontPicker
    | LinkList
    | Liquid
    | Metaobject
    | StyleLayoutPanel
    | StyleSizePanel
    | StyleSpacingPanel;

  export enum Type {
    // Resource Settings
    Article = 'article',
    Blog = 'blog',
    Collection = 'collection',
    Page = 'page',
    Product = 'product',

    // Resource List Settings
    CollectionList = 'collection_list',
    ProductList = 'product_list',
    MetaobjectList = 'metaobject_list',

    // Text Settings
    Text = 'text',
    Textarea = 'textarea',
    Richtext = 'richtext',
    InlineRichtext = 'inline_richtext',
    Html = 'html',
    Url = 'url',
    TextAlignment = 'text_alignment',

    // Number Settings
    Number = 'number',
    Range = 'range',

    // Choice Settings
    Checkbox = 'checkbox',
    Radio = 'radio',
    Select = 'select',

    // Color Settings
    Color = 'color',
    ColorBackground = 'color_background',
    ColorScheme = 'color_scheme',
    ColorSchemeGroup = 'color_scheme_group',

    // Media Settings
    ImagePicker = 'image_picker',
    Video = 'video',
    VideoUrl = 'video_url',

    // Special Settings
    FontPicker = 'font_picker',
    LinkList = 'link_list',
    Liquid = 'liquid',
    Metaobject = 'metaobject',

    // Style Panel Settings
    StyleLayoutPanel = 'style.layout_panel',
    StyleSizePanel = 'style.size_panel',
    StyleSpacingPanel = 'style.spacing_panel',

    // Sidebar Settings
    Header = 'header',
    Paragraph = 'paragraph',
  }

  // Base Setting Interface
  export interface Base<T extends Type> {
    type: T;
    id: string;
    label?: string;
    info?: string;
  }

  // Sidebar Settings
  export interface Header extends Base<Type.Header> {
    content: string;
  }

  export interface Paragraph extends Base<Type.Paragraph> {
    content: string;
  }

  // Resource Settings
  export interface Resource<T extends Type> extends Base<T> {
    default?: string;
  }

  export interface Article extends Resource<Type.Article> {}
  export interface Blog extends Resource<Type.Blog> {}
  export interface Collection extends Resource<Type.Collection> {}
  export interface Page extends Resource<Type.Page> {}
  export interface Product extends Resource<Type.Product> {}

  // Resource List Settings
  export interface ResourceList<T extends Type> extends Base<T> {
    limit?: number;
  }

  export interface CollectionList extends ResourceList<Type.CollectionList> {}
  export interface ProductList extends ResourceList<Type.ProductList> {}
  export interface MetaobjectList extends ResourceList<Type.MetaobjectList> {
    metaobject_type: string;
  }

  // Text Settings
  export interface TextBase<T extends Type> extends Base<T> {
    default?: string;
    placeholder?: string;
  }

  export interface Text extends TextBase<Type.Text> {}
  export interface Textarea extends TextBase<Type.Textarea> {}
  export interface Richtext extends TextBase<Type.Richtext> {}
  export interface InlineRichtext extends TextBase<Type.InlineRichtext> {}
  export interface Html extends TextBase<Type.Html> {}
  export interface Url extends TextBase<Type.Url> {}

  export interface TextAlignment extends Base<Type.TextAlignment> {
    default?: 'left' | 'center' | 'right' | 'justify';
  }

  // Number Settings
  export interface NumberBase<T extends Type> extends Base<T> {
    default?: number;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
  }

  export interface Number extends NumberBase<Type.Number> {}
  export interface Range extends NumberBase<Type.Range> {}

  // Choice Settings
  export interface Checkbox extends Base<Type.Checkbox> {
    default?: boolean;
  }

  export interface ChoiceOption {
    value: string;
    label: string;
  }

  export interface ChoiceBase<T extends Type> extends Base<T> {
    options: ChoiceOption[];
    default?: string;
  }

  export interface Radio extends ChoiceBase<Type.Radio> {}
  export interface Select extends ChoiceBase<Type.Select> {}

  // Color Settings
  export interface ColorBase<T extends Type> extends Base<T> {
    default?: string;
  }

  export interface Color extends ColorBase<Type.Color> {}
  export interface ColorBackground extends ColorBase<Type.ColorBackground> {}
  export interface ColorScheme extends Base<Type.ColorScheme> {
    default?: string;
  }
  export interface ColorSchemeGroup extends Base<Type.ColorSchemeGroup> {}

  // Media Settings
  export interface ImagePicker extends Base<Type.ImagePicker> {
    default?: string;
  }

  export interface Video extends Base<Type.Video> {
    default?: string;
  }

  export interface VideoUrl extends Base<Type.VideoUrl> {
    default?: string;
    accept: Array<'youtube' | 'vimeo'>;
  }

  // Special Settings
  export interface FontPicker extends Base<Type.FontPicker> {
    default?: string;
  }

  export interface LinkList extends Base<Type.LinkList> {
    default?: string;
  }

  export interface Liquid extends Base<Type.Liquid> {
    default?: string;
  }

  export interface Metaobject extends Base<Type.Metaobject> {
    metaobject_type: string;
  }

  // Style Panel Settings
  export interface StyleLayoutPanel extends Base<Type.StyleLayoutPanel> {
    default?: {
      'flex-direction'?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
      'flex-wrap'?: 'nowrap' | 'wrap' | 'wrap-reverse';
      'justify-content'?:
        | 'flex-start'
        | 'flex-end'
        | 'start'
        | 'end'
        | 'left'
        | 'right'
        | 'center'
        | 'space-between'
        | 'space-around'
        | 'space-evenly';
      'align-items'?:
        | 'stretch'
        | 'flex-start'
        | 'start'
        | 'self-start'
        | 'flex-end'
        | 'end'
        | 'self-end'
        | 'center'
        | 'baseline';
      'align-content'?:
        | 'stretch'
        | 'flex-start'
        | 'start'
        | 'flex-end'
        | 'end'
        | 'center'
        | 'space-between'
        | 'space-around'
        | 'space-evenly';
      gap?: string;
      'row-gap'?: string;
      'column-gap'?: string;
      '@media (--mobile)'?: Partial<StyleLayoutPanel['default']>;
    };
  }

  export interface StyleSizePanel extends Base<Type.StyleSizePanel> {
    default?: {
      width?: string;
      'min-width'?: string;
      'max-width'?: string;
      height?: string;
      'min-height'?: string;
      'max-height'?: string;
      'flex-grow'?: string;
      'flex-shrink'?: string;
      'flex-basis'?: string;
      '@media (--mobile)'?: Partial<StyleSizePanel['default']>;
    };
  }

  export interface StyleSpacingPanel extends Base<Type.StyleSpacingPanel> {
    default?: {
      padding?: string;
      'padding-top'?: string;
      'padding-right'?: string;
      'padding-bottom'?: string;
      'padding-left'?: string;
      'padding-block'?: string;
      'padding-block-start'?: string;
      'padding-block-end'?: string;
      'padding-inline'?: string;
      'padding-inline-start'?: string;
      'padding-inline-end'?: string;
      margin?: string;
      'margin-top'?: string;
      'margin-right'?: string;
      'margin-bottom'?: string;
      'margin-left'?: string;
      'margin-block'?: string;
      'margin-block-start'?: string;
      'margin-block-end'?: string;
      'margin-inline'?: string;
      'margin-inline-start'?: string;
      'margin-inline-end'?: string;
      '@media (--mobile)'?: Partial<StyleSpacingPanel['default']>;
    };
  }
}
