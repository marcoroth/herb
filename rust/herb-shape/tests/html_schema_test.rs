use herb_shape::html_schema::aria::{ABSTRACT_ARIA_ROLES, ARIA_ATTRIBUTES, VALID_ARIA_ROLES};
use herb_shape::html_schema::global_attributes::BOOLEAN_ATTRIBUTES;
use herb_shape::html_schema::svg::{SVG_CAMEL_CASE_ELEMENTS, SVG_LOWERCASE_TO_CAMELCASE};
use herb_shape::{ElementCategory, ElementScope, HtmlSchema};

// ── Void elements ───────────────────────────────────────────────────

#[test]
fn test_void_elements() {
  let void = [
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
  ];

  for tag in &void {
    assert!(HtmlSchema::is_void_element(tag), "{} should be void", tag);
  }

  assert_eq!(void.len(), 14);
}

#[test]
fn test_non_void_elements_are_not_void() {
  for tag in &["div", "span", "p", "a", "table", "form"] {
    assert!(!HtmlSchema::is_void_element(tag), "{} should not be void", tag);
  }
}

// ── Inline elements ─────────────────────────────────────────────────

#[test]
fn test_inline_elements() {
  let inline = [
    "a", "abbr", "acronym", "b", "bdo", "big", "br", "button", "cite", "code", "dfn", "em", "i", "img", "input", "kbd", "label", "map", "object", "output",
    "q", "samp", "script", "select", "small", "span", "strong", "sub", "sup", "textarea", "time", "tt", "var",
  ];

  for tag in &inline {
    assert!(HtmlSchema::is_inline_element(tag), "{} should be inline", tag);
  }
}

// ── Block elements ──────────────────────────────────────────────────

#[test]
fn test_block_elements() {
  let block = [
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
  ];

  for tag in &block {
    assert!(HtmlSchema::is_block_element(tag), "{} should be block", tag);
  }
}

// ── Heading elements ────────────────────────────────────────────────

#[test]
fn test_heading_elements() {
  for tag in &["h1", "h2", "h3", "h4", "h5", "h6"] {
    assert!(HtmlSchema::is_heading_element(tag), "{} should be heading", tag);
  }
  assert!(!HtmlSchema::is_heading_element("div"));
  assert!(!HtmlSchema::is_heading_element("p"));
}

// ── Sectioning elements ─────────────────────────────────────────────

#[test]
fn test_sectioning_elements() {
  for tag in &["article", "aside", "nav", "section"] {
    assert!(HtmlSchema::is_sectioning_element(tag), "{} should be sectioning", tag);
  }
  assert!(!HtmlSchema::is_sectioning_element("div"));
}

// ── Interactive elements ────────────────────────────────────────────

#[test]
fn test_interactive_elements() {
  for tag in &["a", "button", "input", "select", "textarea", "summary", "label", "details"] {
    assert!(HtmlSchema::is_interactive_element(tag), "{} should be interactive", tag);
  }
}

// ── Boolean attributes ──────────────────────────────────────────────

#[test]
fn test_boolean_attributes() {
  let expected = [
    "allowfullscreen",
    "async",
    "autofocus",
    "autoplay",
    "checked",
    "compact",
    "controls",
    "declare",
    "default",
    "defer",
    "disabled",
    "formnovalidate",
    "hidden",
    "itemscope",
    "loop",
    "multiple",
    "muted",
    "nohref",
    "noresize",
    "noshade",
    "novalidate",
    "nowrap",
    "open",
    "readonly",
    "required",
    "reversed",
    "scoped",
    "seamless",
    "selected",
    "sortable",
    "truespeed",
    "typemustmatch",
  ];

  assert_eq!(BOOLEAN_ATTRIBUTES.len(), 32, "should have exactly 32 boolean attributes");

  for attr in &expected {
    assert!(HtmlSchema::is_boolean_attribute(attr), "{} should be a boolean attribute", attr);
  }
}

#[test]
fn test_non_boolean_attributes() {
  for attr in &["class", "id", "style", "src", "href"] {
    assert!(!HtmlSchema::is_boolean_attribute(attr), "{} should not be a boolean attribute", attr);
  }
}

// ── ARIA roles ──────────────────────────────────────────────────────

#[test]
fn test_valid_aria_roles() {
  let roles = [
    "alert",
    "alertdialog",
    "application",
    "article",
    "banner",
    "button",
    "cell",
    "checkbox",
    "columnheader",
    "combobox",
    "command",
    "comment",
    "complementary",
    "composite",
    "contentinfo",
    "definition",
    "dialog",
    "directory",
    "document",
    "feed",
    "figure",
    "form",
    "generic",
    "grid",
    "gridcell",
    "group",
    "heading",
    "img",
    "input",
    "landmark",
    "link",
    "list",
    "listbox",
    "listitem",
    "log",
    "main",
    "mark",
    "marquee",
    "math",
    "menu",
    "menubar",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "meter",
    "navigation",
    "none",
    "note",
    "option",
    "paragraph",
    "presentation",
    "progressbar",
    "radio",
    "radiogroup",
    "range",
    "region",
    "roletype",
    "row",
    "rowgroup",
    "rowheader",
    "scrollbar",
    "search",
    "searchbox",
    "section",
    "sectionhead",
    "select",
    "separator",
    "slider",
    "spinbutton",
    "status",
    "structure",
    "suggestion",
    "switch",
    "tab",
    "table",
    "tablist",
    "tabpanel",
    "term",
    "textbox",
    "timer",
    "toolbar",
    "tooltip",
    "tree",
    "treegrid",
    "treeitem",
    "widget",
    "window",
  ];

  assert_eq!(VALID_ARIA_ROLES.len(), roles.len(), "should have exactly {} ARIA roles", roles.len());

  for role in &roles {
    assert!(HtmlSchema::is_valid_aria_role(role), "{} should be a valid ARIA role", role);
  }
}

#[test]
fn test_abstract_aria_roles() {
  let abstract_roles = [
    "command",
    "composite",
    "input",
    "landmark",
    "range",
    "roletype",
    "section",
    "sectionhead",
    "select",
    "structure",
    "widget",
    "window",
  ];

  assert_eq!(ABSTRACT_ARIA_ROLES.len(), 12, "should have exactly 12 abstract ARIA roles");

  for role in &abstract_roles {
    assert!(HtmlSchema::is_abstract_aria_role(role), "{} should be an abstract ARIA role", role);
  }
}

#[test]
fn test_non_abstract_roles_are_not_abstract() {
  for role in &["button", "checkbox", "link", "alert", "dialog"] {
    assert!(!HtmlSchema::is_abstract_aria_role(role), "{} should not be abstract", role);
  }
}

// ── ARIA attributes ─────────────────────────────────────────────────

#[test]
fn test_aria_attributes() {
  let attrs = [
    "aria-activedescendant",
    "aria-atomic",
    "aria-autocomplete",
    "aria-busy",
    "aria-checked",
    "aria-colcount",
    "aria-colindex",
    "aria-colspan",
    "aria-controls",
    "aria-current",
    "aria-describedby",
    "aria-details",
    "aria-disabled",
    "aria-dropeffect",
    "aria-errormessage",
    "aria-expanded",
    "aria-flowto",
    "aria-grabbed",
    "aria-haspopup",
    "aria-hidden",
    "aria-invalid",
    "aria-keyshortcuts",
    "aria-label",
    "aria-labelledby",
    "aria-level",
    "aria-live",
    "aria-modal",
    "aria-multiline",
    "aria-multiselectable",
    "aria-orientation",
    "aria-owns",
    "aria-placeholder",
    "aria-posinset",
    "aria-pressed",
    "aria-readonly",
    "aria-relevant",
    "aria-required",
    "aria-roledescription",
    "aria-rowcount",
    "aria-rowindex",
    "aria-rowspan",
    "aria-selected",
    "aria-setsize",
    "aria-sort",
    "aria-valuemax",
    "aria-valuemin",
    "aria-valuenow",
    "aria-valuetext",
  ];

  assert_eq!(ARIA_ATTRIBUTES.len(), 48, "should have exactly 48 ARIA attributes");

  for attr in &attrs {
    assert!(HtmlSchema::is_valid_aria_attribute(attr), "{} should be a valid ARIA attribute", attr);
  }
}

#[test]
fn test_invalid_aria_attribute() {
  assert!(!HtmlSchema::is_valid_aria_attribute("aria-foo"));
  assert!(!HtmlSchema::is_valid_aria_attribute("aria-"));
  assert!(!HtmlSchema::is_valid_aria_attribute("class"));
}

// ── SVG elements ────────────────────────────────────────────────────

#[test]
fn test_svg_camel_case_elements() {
  let expected = [
    "animateMotion",
    "animateTransform",
    "clipPath",
    "feBlend",
    "feColorMatrix",
    "feComponentTransfer",
    "feComposite",
    "feConvolveMatrix",
    "feDiffuseLighting",
    "feDisplacementMap",
    "feDistantLight",
    "feDropShadow",
    "feFlood",
    "feFuncA",
    "feFuncB",
    "feFuncG",
    "feFuncR",
    "feGaussianBlur",
    "feImage",
    "feMerge",
    "feMergeNode",
    "feMorphology",
    "feOffset",
    "fePointLight",
    "feSpecularLighting",
    "feSpotLight",
    "feTile",
    "feTurbulence",
    "foreignObject",
    "glyphRef",
    "linearGradient",
    "radialGradient",
    "textPath",
  ];

  assert_eq!(SVG_CAMEL_CASE_ELEMENTS.len(), 33, "should have exactly 33 SVG camelCase elements");

  for name in &expected {
    assert!(SVG_CAMEL_CASE_ELEMENTS.contains(name), "{} should be in SVG camelCase elements", name);
  }
}

#[test]
fn test_svg_canonical_name_lookup() {
  assert_eq!(HtmlSchema::svg_canonical_name("clippath"), Some("clipPath"));
  assert_eq!(HtmlSchema::svg_canonical_name("ClipPath"), Some("clipPath"));
  assert_eq!(HtmlSchema::svg_canonical_name("foreignobject"), Some("foreignObject"));
  assert_eq!(HtmlSchema::svg_canonical_name("lineargradient"), Some("linearGradient"));
  assert_eq!(HtmlSchema::svg_canonical_name("radialgradient"), Some("radialGradient"));
  assert_eq!(HtmlSchema::svg_canonical_name("textpath"), Some("textPath"));
  assert_eq!(HtmlSchema::svg_canonical_name("feblend"), Some("feBlend"));
  assert_eq!(HtmlSchema::svg_canonical_name("fegaussianblur"), Some("feGaussianBlur"));
}

#[test]
fn test_svg_canonical_name_not_found() {
  assert_eq!(HtmlSchema::svg_canonical_name("div"), None);
  assert_eq!(HtmlSchema::svg_canonical_name("rect"), None);
  assert_eq!(HtmlSchema::svg_canonical_name("circle"), None);
}

#[test]
fn test_svg_lowercase_to_camelcase_map() {
  assert_eq!(SVG_LOWERCASE_TO_CAMELCASE.get("clippath"), Some(&"clipPath"));
  assert_eq!(SVG_LOWERCASE_TO_CAMELCASE.get("animatemotion"), Some(&"animateMotion"));
  assert_eq!(SVG_LOWERCASE_TO_CAMELCASE.get("fecolormatrix"), Some(&"feColorMatrix"));
  assert_eq!(SVG_LOWERCASE_TO_CAMELCASE.len(), 33);
}

// ── Required attributes ─────────────────────────────────────────────

#[test]
fn test_required_attributes() {
  assert_eq!(HtmlSchema::required_attributes("img"), vec!["alt"]);
  assert_eq!(HtmlSchema::required_attributes("a"), vec!["href"]);
  assert_eq!(HtmlSchema::required_attributes("iframe"), vec!["title"]);
}

#[test]
fn test_no_required_attributes() {
  assert!(HtmlSchema::required_attributes("div").is_empty());
  assert!(HtmlSchema::required_attributes("span").is_empty());
  assert!(HtmlSchema::required_attributes("unknown").is_empty());
}

// ── Element scope ───────────────────────────────────────────────────

#[test]
fn test_element_scope() {
  assert_eq!(HtmlSchema::element_scope("html"), Some(ElementScope::DocumentRoot));
  assert_eq!(HtmlSchema::element_scope("head"), Some(ElementScope::HtmlOnly));
  assert_eq!(HtmlSchema::element_scope("body"), Some(ElementScope::HtmlOnly));
  assert_eq!(HtmlSchema::element_scope("meta"), Some(ElementScope::HeadOnly));
  assert_eq!(HtmlSchema::element_scope("link"), Some(ElementScope::HeadOnly));
  assert_eq!(HtmlSchema::element_scope("base"), Some(ElementScope::HeadOnly));
  assert_eq!(HtmlSchema::element_scope("title"), Some(ElementScope::HeadOnly));
  assert_eq!(HtmlSchema::element_scope("style"), Some(ElementScope::HeadOnly));
  assert_eq!(HtmlSchema::element_scope("script"), Some(ElementScope::HeadOrBody));
  assert_eq!(HtmlSchema::element_scope("noscript"), Some(ElementScope::HeadOrBody));
  assert_eq!(HtmlSchema::element_scope("template"), Some(ElementScope::HeadOrBody));
  assert_eq!(HtmlSchema::element_scope("div"), Some(ElementScope::BodyOnly));
  assert_eq!(HtmlSchema::element_scope("p"), Some(ElementScope::BodyOnly));
  assert_eq!(HtmlSchema::element_scope("span"), Some(ElementScope::BodyOnly));
}

#[test]
fn test_head_only_elements() {
  for tag in &["base", "title", "style", "meta", "link"] {
    assert!(HtmlSchema::is_head_only(tag), "{} should be head-only", tag);
  }
  assert!(!HtmlSchema::is_head_only("div"));
  assert!(!HtmlSchema::is_head_only("script"));
}

#[test]
fn test_body_only_elements() {
  assert!(HtmlSchema::is_body_only("div"));
  assert!(HtmlSchema::is_body_only("span"));
  assert!(HtmlSchema::is_body_only("p"));
  assert!(!HtmlSchema::is_body_only("html"));
  assert!(!HtmlSchema::is_body_only("head"));
  assert!(!HtmlSchema::is_body_only("meta"));
  assert!(!HtmlSchema::is_body_only("script"));
}

// ── Disabled support ────────────────────────────────────────────────

#[test]
fn test_supports_disabled() {
  for tag in &["button", "fieldset", "input", "optgroup", "option", "select", "textarea"] {
    assert!(HtmlSchema::supports_disabled(tag), "{} should support disabled", tag);
  }
}

#[test]
fn test_does_not_support_disabled() {
  for tag in &["div", "span", "a", "p", "img"] {
    assert!(!HtmlSchema::supports_disabled(tag), "{} should not support disabled", tag);
  }
}

// ── Case insensitivity ──────────────────────────────────────────────

#[test]
fn test_case_insensitive_lookups() {
  assert!(HtmlSchema::is_void_element("BR"));
  assert!(HtmlSchema::is_void_element("Br"));
  assert!(HtmlSchema::is_inline_element("SPAN"));
  assert!(HtmlSchema::is_block_element("DIV"));
  assert!(HtmlSchema::is_boolean_attribute("CHECKED"));
  assert!(HtmlSchema::is_valid_aria_role("BUTTON"));
  assert!(HtmlSchema::is_valid_aria_attribute("ARIA-LABEL"));
  assert_eq!(HtmlSchema::element_scope("HTML"), Some(ElementScope::DocumentRoot));
}

// ── Element lookup ──────────────────────────────────────────────────

#[test]
fn test_element_lookup() {
  let div = HtmlSchema::element("div").expect("div should exist");
  assert_eq!(div.tag_name, "div");
  assert!(div.categories.contains(&ElementCategory::Block));
  assert_eq!(div.scope, ElementScope::BodyOnly);
  assert!(div.required_attributes.is_empty());
  assert!(!div.supports_disabled);
}

#[test]
fn test_element_lookup_unknown() {
  assert!(HtmlSchema::element("custom-element").is_none());
  assert!(HtmlSchema::element("xyz").is_none());
}

// ── has_category ────────────────────────────────────────────────────

#[test]
fn test_has_category() {
  assert!(HtmlSchema::has_category("img", ElementCategory::Void));
  assert!(HtmlSchema::has_category("img", ElementCategory::Inline));
  assert!(HtmlSchema::has_category("img", ElementCategory::Embedded));
  assert!(!HtmlSchema::has_category("img", ElementCategory::Block));

  assert!(HtmlSchema::has_category("div", ElementCategory::Block));
  assert!(!HtmlSchema::has_category("div", ElementCategory::Inline));
}

#[test]
fn test_unknown_element_has_no_category() {
  assert!(!HtmlSchema::has_category("unknown", ElementCategory::Block));
  assert!(!HtmlSchema::has_category("unknown", ElementCategory::Void));
}
