export declare namespace Setting {
    /** Setting values are  */
    type Values = Record<string, string | number | boolean | string[]>;
    /** Union type of all setting types */
    type Any = InputSetting | SideBarSetting;
    /** Settings used for display */
    type SideBarSetting = Header | Paragraph;
    /** Settings with data */
    type InputSetting = Article | Blog | Collection | Page | Product | CollectionList | ProductList | MetaobjectList | Text | Textarea | Richtext | InlineRichtext | Html | Url | TextAlignment | Number | Range | Checkbox | Radio | Select | Color | ColorBackground | ColorScheme | ColorSchemeGroup | ImagePicker | Video | VideoUrl | FontPicker | LinkList | Liquid | Metaobject | StyleLayoutPanel | StyleSizePanel | StyleSpacingPanel;
    enum Type {
        Article = "article",
        Blog = "blog",
        Collection = "collection",
        Page = "page",
        Product = "product",
        CollectionList = "collection_list",
        ProductList = "product_list",
        MetaobjectList = "metaobject_list",
        Text = "text",
        Textarea = "textarea",
        Richtext = "richtext",
        InlineRichtext = "inline_richtext",
        Html = "html",
        Url = "url",
        TextAlignment = "text_alignment",
        Number = "number",
        Range = "range",
        Checkbox = "checkbox",
        Radio = "radio",
        Select = "select",
        Color = "color",
        ColorBackground = "color_background",
        ColorScheme = "color_scheme",
        ColorSchemeGroup = "color_scheme_group",
        ImagePicker = "image_picker",
        Video = "video",
        VideoUrl = "video_url",
        FontPicker = "font_picker",
        LinkList = "link_list",
        Liquid = "liquid",
        Metaobject = "metaobject",
        StyleLayoutPanel = "style.layout_panel",
        StyleSizePanel = "style.size_panel",
        StyleSpacingPanel = "style.spacing_panel",
        Header = "header",
        Paragraph = "paragraph"
    }
    interface Base<T extends Type> {
        type: T;
        id: string;
        label?: string;
        info?: string;
    }
    interface Header extends Base<Type.Header> {
        content: string;
    }
    interface Paragraph extends Base<Type.Paragraph> {
        content: string;
    }
    interface Resource<T extends Type> extends Base<T> {
        default?: string;
    }
    interface Article extends Resource<Type.Article> {
    }
    interface Blog extends Resource<Type.Blog> {
    }
    interface Collection extends Resource<Type.Collection> {
    }
    interface Page extends Resource<Type.Page> {
    }
    interface Product extends Resource<Type.Product> {
    }
    interface ResourceList<T extends Type> extends Base<T> {
        limit?: number;
    }
    interface CollectionList extends ResourceList<Type.CollectionList> {
    }
    interface ProductList extends ResourceList<Type.ProductList> {
    }
    interface MetaobjectList extends ResourceList<Type.MetaobjectList> {
        metaobject_type: string;
    }
    interface TextBase<T extends Type> extends Base<T> {
        default?: string;
        placeholder?: string;
    }
    interface Text extends TextBase<Type.Text> {
    }
    interface Textarea extends TextBase<Type.Textarea> {
    }
    interface Richtext extends TextBase<Type.Richtext> {
    }
    interface InlineRichtext extends TextBase<Type.InlineRichtext> {
    }
    interface Html extends TextBase<Type.Html> {
    }
    interface Url extends TextBase<Type.Url> {
    }
    interface TextAlignment extends Base<Type.TextAlignment> {
        default?: 'left' | 'center' | 'right' | 'justify';
    }
    interface NumberBase<T extends Type> extends Base<T> {
        default?: number;
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
    }
    interface Number extends NumberBase<Type.Number> {
    }
    interface Range extends NumberBase<Type.Range> {
    }
    interface Checkbox extends Base<Type.Checkbox> {
        default?: boolean;
    }
    interface ChoiceOption {
        value: string;
        label: string;
    }
    interface ChoiceBase<T extends Type> extends Base<T> {
        options: ChoiceOption[];
        default?: string;
    }
    interface Radio extends ChoiceBase<Type.Radio> {
    }
    interface Select extends ChoiceBase<Type.Select> {
    }
    interface ColorBase<T extends Type> extends Base<T> {
        default?: string;
    }
    interface Color extends ColorBase<Type.Color> {
    }
    interface ColorBackground extends ColorBase<Type.ColorBackground> {
    }
    interface ColorScheme extends Base<Type.ColorScheme> {
        default?: string;
    }
    interface ColorSchemeGroup extends Base<Type.ColorSchemeGroup> {
    }
    interface ImagePicker extends Base<Type.ImagePicker> {
        default?: string;
    }
    interface Video extends Base<Type.Video> {
        default?: string;
    }
    interface VideoUrl extends Base<Type.VideoUrl> {
        default?: string;
        accept: Array<'youtube' | 'vimeo'>;
    }
    interface FontPicker extends Base<Type.FontPicker> {
        default?: string;
    }
    interface LinkList extends Base<Type.LinkList> {
        default?: string;
    }
    interface Liquid extends Base<Type.Liquid> {
        default?: string;
    }
    interface Metaobject extends Base<Type.Metaobject> {
        metaobject_type: string;
    }
    interface StyleLayoutPanel extends Base<Type.StyleLayoutPanel> {
        default?: {
            'flex-direction'?: 'row' | 'row-reverse' | 'column' | 'column-reverse';
            'flex-wrap'?: 'nowrap' | 'wrap' | 'wrap-reverse';
            'justify-content'?: 'flex-start' | 'flex-end' | 'start' | 'end' | 'left' | 'right' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
            'align-items'?: 'stretch' | 'flex-start' | 'start' | 'self-start' | 'flex-end' | 'end' | 'self-end' | 'center' | 'baseline';
            'align-content'?: 'stretch' | 'flex-start' | 'start' | 'flex-end' | 'end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
            gap?: string;
            'row-gap'?: string;
            'column-gap'?: string;
            '@media (--mobile)'?: Partial<StyleLayoutPanel['default']>;
        };
    }
    interface StyleSizePanel extends Base<Type.StyleSizePanel> {
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
    interface StyleSpacingPanel extends Base<Type.StyleSpacingPanel> {
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
