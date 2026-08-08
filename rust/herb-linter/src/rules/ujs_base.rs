use std::collections::HashSet;

use crate::offense::UnboundOffense;
use crate::utils::source_slice::location_from_offset;
use crate::utils::tag_utils::{filter_html_attribute_nodes, get_attribute_name};

use herb::nodes::{AnyNode, ERBBlockNode, ERBContentNode, ERBOpenTagNode, HTMLOpenTagNode};
use herb::prism::PrismNode;
use herb::Visitor;

pub struct UJSReplacement {
  pub attribute: &'static str,
  pub option: &'static str,
}

pub struct UJSKeyword {
  pub name: &'static str,
  pub helpers: HashSet<&'static str>,
}

pub struct UJSAttributeDescriptor {
  pub attribute: &'static str,
  pub data_key: &'static str,
  pub replacement: Option<UJSReplacement>,
  pub keyword: Option<UJSKeyword>,
}

impl UJSAttributeDescriptor {
  fn attribute_message(&self) -> String {
    match &self.replacement {
      None => format!(
        "Avoid the deprecated `@rails/ujs` attribute `{}`. Turbo handles links and form submissions by default, so it can be removed.",
        self.attribute
      ),
      Some(replacement) => format!(
        "Avoid the deprecated `@rails/ujs` attribute `{}`. Use `{}` instead.",
        self.attribute, replacement.attribute
      ),
    }
  }

  fn option_message(&self) -> String {
    match &self.replacement {
      None => format!(
        "Avoid the deprecated `@rails/ujs` option, which renders `{}`. Turbo handles links and form submissions by default, so it can be removed.",
        self.attribute
      ),
      Some(replacement) => format!(
        "Avoid the deprecated `@rails/ujs` option, which renders `{}`. Use `{}` instead.",
        self.attribute, replacement.option
      ),
    }
  }
}

fn symbol_key(node: &PrismNode) -> Option<&str> {
  if !node.is("SymbolNode") {
    return None;
  }

  node.unescaped.as_deref()
}

fn collect_option_keys<'node>(descriptor: &UJSAttributeDescriptor, node: &'node PrismNode, keys: &mut Vec<&'node PrismNode>) {
  if node.is("CallNode") {
    check_keyword_arguments(descriptor, node, keys);
  }

  for child in &node.children {
    collect_option_keys(descriptor, child, keys);
  }
}

fn check_keyword_arguments<'node>(descriptor: &UJSAttributeDescriptor, node: &'node PrismNode, keys: &mut Vec<&'node PrismNode>) {
  let arguments = match node.field_one("arguments") {
    Some(arguments) => arguments.field("arguments"),
    None => return,
  };

  let keywords = match arguments.last() {
    Some(keywords) if keywords.is("KeywordHashNode") => keywords,
    _ => return,
  };

  for element in keywords.field("elements") {
    if !element.is("AssocNode") {
      continue;
    }

    let key = match element.field_one("key").and_then(symbol_key) {
      Some(key) => key,
      None => continue,
    };

    if key == "data" {
      if let Some(value) = element.field_one("value") {
        check_data_hash(descriptor, value, keys);
      }

      continue;
    }

    let keyword = match &descriptor.keyword {
      Some(keyword) => keyword,
      None => continue,
    };

    if key == keyword.name && node.receiver().is_none() && node.name.as_deref().is_some_and(|name| keyword.helpers.contains(name)) {
      if let Some(key_node) = element.field_one("key") {
        keys.push(key_node);
      }
    }
  }
}

fn check_data_hash<'node>(descriptor: &UJSAttributeDescriptor, hash: &'node PrismNode, keys: &mut Vec<&'node PrismNode>) {
  if !hash.is("HashNode") && !hash.is("KeywordHashNode") {
    return;
  }

  for element in hash.field("elements") {
    if !element.is("AssocNode") {
      continue;
    }

    if element.field_one("key").and_then(symbol_key) != Some(descriptor.data_key) {
      continue;
    }

    if let Some(key_node) = element.field_one("key") {
      keys.push(key_node);
    }
  }
}

pub struct UJSAttributeVisitor<'rule> {
  pub rule_name: &'static str,
  pub offenses: Vec<UnboundOffense>,
  pub descriptor: &'rule UJSAttributeDescriptor,
  pub source: &'rule str,
}

impl<'rule> UJSAttributeVisitor<'rule> {
  fn add(&mut self, message: String, location: herb::Location) {
    self
      .offenses
      .push(UnboundOffense::with_tags(self.rule_name, message, location, vec!["deprecated".to_string()]));
  }

  fn check_attributes(&mut self, children: &[AnyNode], from_helper: bool) {
    let matching: Vec<herb::Location> = filter_html_attribute_nodes(children)
      .into_iter()
      .filter(|attribute| get_attribute_name(attribute).as_deref() == Some(self.descriptor.attribute))
      .filter_map(|attribute| attribute.name.as_ref().map(|name| name.location.clone()))
      .collect();

    for location in matching {
      let message = if from_helper {
        self.descriptor.option_message()
      } else {
        self.descriptor.attribute_message()
      };

      self.add(message, location);
    }
  }

  fn check_helper_options(&mut self, prism_node: Option<&PrismNode>) {
    let prism_node = match prism_node {
      Some(prism_node) if !self.source.is_empty() => prism_node,
      _ => return,
    };

    let mut keys = Vec::new();

    collect_option_keys(self.descriptor, prism_node, &mut keys);

    let locations: Vec<herb::Location> = keys
      .into_iter()
      .map(|key| location_from_offset(self.source, key.start_offset, key.end_offset))
      .collect();

    for location in locations {
      let message = self.descriptor.option_message();

      self.add(message, location);
    }
  }
}

impl<'rule> Visitor for UJSAttributeVisitor<'rule> {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.check_attributes(&node.children, false);

    self.walk_html_open_tag_node(node);
  }

  fn visit_erb_open_tag_node(&mut self, node: &ERBOpenTagNode) {
    self.check_attributes(&node.children, true);

    self.walk_erb_open_tag_node(node);
  }

  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    self.check_helper_options(node.prism());

    self.walk_erb_content_node(node);
  }

  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    self.check_helper_options(node.prism());

    self.walk_erb_block_node(node);
  }
}
