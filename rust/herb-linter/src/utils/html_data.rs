use std::collections::HashSet;
use std::sync::LazyLock;

pub static HTML_VOID_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source",
    "track", "wbr",
  ]
  .into_iter()
  .collect()
});

pub static HTML_INLINE_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| {
  [
    "a", "abbr", "acronym", "b", "bdo", "big", "br", "button", "cite", "code", "dfn", "em", "i",
    "img", "input", "kbd", "label", "map", "object", "output", "q", "samp", "script", "select",
    "small", "span", "strong", "sub", "sup", "textarea", "time", "tt", "var",
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
