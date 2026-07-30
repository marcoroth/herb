use std::collections::HashSet;
use std::sync::LazyLock;

pub static HTML_VOID_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
  ]
  .into_iter()
  .collect()
});

pub static HTML_INLINE_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "a", "abbr", "acronym", "b", "bdo", "big", "br", "button", "cite", "code", "dfn", "em", "i", "img", "input", "kbd", "label", "map", "object", "output",
    "q", "samp", "script", "select", "small", "span", "strong", "sub", "sup", "textarea", "time", "tt", "var",
  ]
  .into_iter()
  .collect()
});

pub static HTML_BLOCK_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "address",
    "article",
    "aside",
    "blockquote",
    "canvas",
    "dd",
    "div",
    "dl",
    "dt",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "li",
    "main",
    "nav",
    "noscript",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "tfoot",
    "ul",
    "video",
  ]
  .into_iter()
  .collect()
});

pub static HTML_BOOLEAN_ATTRIBUTES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "autofocus",
    "autoplay",
    "checked",
    "controls",
    "defer",
    "disabled",
    "hidden",
    "loop",
    "multiple",
    "muted",
    "readonly",
    "required",
    "reversed",
    "selected",
    "open",
    "default",
    "formnovalidate",
    "novalidate",
    "itemscope",
    "scoped",
    "seamless",
    "allowfullscreen",
    "async",
    "compact",
    "declare",
    "nohref",
    "noresize",
    "noshade",
    "nowrap",
    "sortable",
    "truespeed",
    "typemustmatch",
  ]
  .into_iter()
  .collect()
});

pub static HEAD_ONLY_TAG_NAMES: LazyLock<HashSet<&'static str>> = LazyLock::new(|| ["base", "title", "style", "meta", "link"].into_iter().collect());

pub fn is_head_only_element(tag_name: &str) -> bool {
  HEAD_ONLY_TAG_NAMES.contains(tag_name.to_lowercase().as_str())
}

pub fn is_void_element(tag_name: &str) -> bool {
  HTML_VOID_ELEMENTS.contains(tag_name.to_lowercase().as_str())
}

pub fn is_inline_element(tag_name: &str) -> bool {
  HTML_INLINE_ELEMENTS.contains(tag_name.to_lowercase().as_str())
}

pub fn is_block_element(tag_name: &str) -> bool {
  HTML_BLOCK_ELEMENTS.contains(tag_name.to_lowercase().as_str())
}

pub fn is_boolean_attribute(attribute_name: &str) -> bool {
  HTML_BOOLEAN_ATTRIBUTES.contains(attribute_name.to_lowercase().as_str())
}

const HTML_KNOWN_ELEMENTS: &[&str] = &[
  "html",
  "head",
  "body",
  "base",
  "link",
  "meta",
  "style",
  "title",
  "script",
  "noscript",
  "template",
  "slot",
  "selectedcontent",
  "address",
  "article",
  "aside",
  "footer",
  "header",
  "hgroup",
  "main",
  "nav",
  "section",
  "search",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "dd",
  "details",
  "dialog",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "hr",
  "li",
  "menu",
  "ol",
  "p",
  "pre",
  "summary",
  "ul",
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  "del",
  "ins",
  "area",
  "audio",
  "canvas",
  "embed",
  "iframe",
  "img",
  "map",
  "math",
  "object",
  "param",
  "picture",
  "source",
  "svg",
  "track",
  "video",
  "caption",
  "col",
  "colgroup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "button",
  "datalist",
  "fieldset",
  "form",
  "input",
  "label",
  "legend",
  "meter",
  "optgroup",
  "option",
  "output",
  "progress",
  "select",
  "textarea",
  "acronym",
  "big",
  "tt",
];

const SVG_KNOWN_ELEMENTS: &[&str] = &[
  "a",
  "animate",
  "animatemotion",
  "animatetransform",
  "circle",
  "clippath",
  "defs",
  "desc",
  "ellipse",
  "feblend",
  "fecolormatrix",
  "fecomponenttransfer",
  "fecomposite",
  "feconvolvematrix",
  "fediffuselighting",
  "fedisplacementmap",
  "fedistantlight",
  "fedropshadow",
  "feflood",
  "fefunca",
  "fefuncb",
  "fefuncg",
  "fefuncr",
  "fegaussianblur",
  "feimage",
  "femerge",
  "femergenode",
  "femorphology",
  "feoffset",
  "fepointlight",
  "fespecularlighting",
  "fespotlight",
  "fetile",
  "feturbulence",
  "filter",
  "foreignobject",
  "g",
  "glyphref",
  "image",
  "line",
  "lineargradient",
  "marker",
  "mask",
  "metadata",
  "path",
  "pattern",
  "polygon",
  "polyline",
  "radialgradient",
  "rect",
  "set",
  "stop",
  "style",
  "switch",
  "symbol",
  "text",
  "textpath",
  "title",
  "tspan",
  "use",
];

const MATHML_KNOWN_ELEMENTS: &[&str] = &[
  "annotation",
  "annotation-xml",
  "maction",
  "math",
  "menclose",
  "merror",
  "mfenced",
  "mfrac",
  "mglyph",
  "mi",
  "mlabeledtr",
  "mmultiscripts",
  "mn",
  "mo",
  "mover",
  "mpadded",
  "mphantom",
  "mprescripts",
  "mroot",
  "mrow",
  "ms",
  "mspace",
  "msqrt",
  "mstyle",
  "msub",
  "msubsup",
  "msup",
  "mtable",
  "mtd",
  "mtext",
  "mtr",
  "munder",
  "munderover",
  "none",
  "semantics",
];

pub fn is_known_html_element(tag_name: &str) -> bool {
  HTML_KNOWN_ELEMENTS.contains(&tag_name.to_lowercase().as_str())
}

pub fn is_known_svg_element(tag_name: &str) -> bool {
  SVG_KNOWN_ELEMENTS.contains(&tag_name.to_lowercase().as_str())
}

pub fn is_known_mathml_element(tag_name: &str) -> bool {
  MATHML_KNOWN_ELEMENTS.contains(&tag_name.to_lowercase().as_str())
}

pub fn is_custom_element(tag_name: &str) -> bool {
  tag_name.contains('-')
}
