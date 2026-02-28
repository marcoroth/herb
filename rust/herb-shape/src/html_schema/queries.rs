use std::collections::HashSet;
use std::sync::LazyLock;

use super::aria::{ABSTRACT_ARIA_ROLES, ARIA_ATTRIBUTES, VALID_ARIA_ROLES};
use super::global_attributes::BOOLEAN_ATTRIBUTES;
use super::registry::HTML_ELEMENTS;
use super::svg::SVG_LOWERCASE_TO_CAMELCASE;
use super::types::{ElementCategory, ElementDef, ElementScope};

static VOID_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_category(ElementCategory::Void));

static INLINE_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_category(ElementCategory::Inline));

static BLOCK_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_category(ElementCategory::Block));

static HEADING_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_category(ElementCategory::Heading));

static SECTIONING_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_category(ElementCategory::Sectioning));

static INTERACTIVE_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_category(ElementCategory::Interactive));

static HEAD_ONLY_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_scope(ElementScope::HeadOnly));

static BODY_ONLY_ELEMENTS: LazyLock<HashSet<&'static str>> = LazyLock::new(|| elements_with_scope(ElementScope::BodyOnly));

fn elements_with_category(category: ElementCategory) -> HashSet<&'static str> {
  HTML_ELEMENTS
    .iter()
    .filter(|(_, definition)| definition.categories.contains(&category))
    .map(|(&name, _)| name)
    .collect()
}

fn elements_with_scope(scope: ElementScope) -> HashSet<&'static str> {
  HTML_ELEMENTS
    .iter()
    .filter(|(_, definition)| definition.scope == scope)
    .map(|(&name, _)| name)
    .collect()
}

pub struct HtmlSchema;

impl HtmlSchema {
  pub fn element(tag_name: &str) -> Option<&'static ElementDef> {
    HTML_ELEMENTS.get(tag_name.to_lowercase().as_str())
  }

  pub fn is_void_element(tag_name: &str) -> bool {
    VOID_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn is_inline_element(tag_name: &str) -> bool {
    INLINE_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn is_block_element(tag_name: &str) -> bool {
    BLOCK_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn is_heading_element(tag_name: &str) -> bool {
    HEADING_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn is_sectioning_element(tag_name: &str) -> bool {
    SECTIONING_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn is_interactive_element(tag_name: &str) -> bool {
    INTERACTIVE_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn has_category(tag_name: &str, category: ElementCategory) -> bool {
    HTML_ELEMENTS
      .get(tag_name.to_lowercase().as_str())
      .map_or(false, |definition| definition.categories.contains(&category))
  }

  pub fn is_head_only(tag_name: &str) -> bool {
    HEAD_ONLY_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn is_body_only(tag_name: &str) -> bool {
    BODY_ONLY_ELEMENTS.contains(tag_name.to_lowercase().as_str())
  }

  pub fn element_scope(tag_name: &str) -> Option<ElementScope> {
    HTML_ELEMENTS.get(tag_name.to_lowercase().as_str()).map(|definition| definition.scope)
  }

  pub fn is_boolean_attribute(attribute_name: &str) -> bool {
    BOOLEAN_ATTRIBUTES.contains(attribute_name.to_lowercase().as_str())
  }

  pub fn supports_disabled(tag_name: &str) -> bool {
    HTML_ELEMENTS
      .get(tag_name.to_lowercase().as_str())
      .map_or(false, |definition| definition.supports_disabled)
  }

  pub fn required_attributes(tag_name: &str) -> Vec<&'static str> {
    HTML_ELEMENTS
      .get(tag_name.to_lowercase().as_str())
      .map_or_else(Vec::new, |definition| definition.required_attributes.clone())
  }

  pub fn is_valid_aria_role(role: &str) -> bool {
    VALID_ARIA_ROLES.contains(role.to_lowercase().as_str())
  }

  pub fn is_abstract_aria_role(role: &str) -> bool {
    ABSTRACT_ARIA_ROLES.contains(role.to_lowercase().as_str())
  }

  pub fn is_valid_aria_attribute(attribute: &str) -> bool {
    ARIA_ATTRIBUTES.contains(attribute.to_lowercase().as_str())
  }

  pub fn svg_canonical_name(tag_name: &str) -> Option<&'static str> {
    SVG_LOWERCASE_TO_CAMELCASE.get(&tag_name.to_lowercase()).copied()
  }
}
