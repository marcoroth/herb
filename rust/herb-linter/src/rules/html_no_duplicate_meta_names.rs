use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::control_flow_tracker::{ControlFlowTracker, ControlFlowType};
use crate::utils::element_stack::ElementStack;
use crate::utils::tag_utils::{get_attribute, get_open_tag, get_static_attribute_value, get_tag_name_from_element};

use herb::nodes::*;
use herb::ParseResult;
use herb::Visitor;
use herb_config::Severity;

pub struct HTMLNoDuplicateMetaNamesRule;

#[derive(Clone)]
struct MetaTag {
  name_value: Option<String>,
  http_equiv_value: Option<String>,
  media_value: Option<String>,
  location: herb::location::Location,
}

struct NoDuplicateMetaNamesVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  element_stack: ElementStack,
  document_metas: Vec<MetaTag>,
  tracker: ControlFlowTracker<Vec<MetaTag>>,
}

impl NoDuplicateMetaNamesVisitor {
  fn handle_exit_control_flow(&mut self) {
    if let Some(mut exit_info) = self.tracker.exit_control_flow() {
      if exit_info.was_conditional {
        self.document_metas.append(&mut exit_info.values);
      }
    }
  }

  fn extract_meta_attributes(&self, node: &HTMLElementNode) -> MetaTag {
    let mut meta = MetaTag {
      name_value: None,
      http_equiv_value: None,
      media_value: None,
      location: node.location.clone(),
    };

    if let Some(open_tag) = get_open_tag(node) {
      if let Some(name_attribute) = get_attribute(open_tag, "name") {
        if let Some(value) = get_static_attribute_value(name_attribute) {
          let trimmed = value.trim().to_string();

          if !trimmed.is_empty() {
            meta.name_value = Some(trimmed);
          }
        }
      }

      if let Some(http_equiv_attribute) = get_attribute(open_tag, "http-equiv") {
        if let Some(value) = get_static_attribute_value(http_equiv_attribute) {
          let trimmed = value.trim().to_string();

          if !trimmed.is_empty() {
            meta.http_equiv_value = Some(trimmed);
          }
        }
      }

      if let Some(media_attribute) = get_attribute(open_tag, "media") {
        if let Some(value) = get_static_attribute_value(media_attribute) {
          let trimmed = value.trim().to_string();

          if !trimmed.is_empty() {
            meta.media_value = Some(trimmed);
          }
        }
      }
    }

    meta
  }

  fn are_meta_tags_duplicate(meta1: &MetaTag, meta2: &MetaTag) -> bool {
    match (&meta1.media_value, &meta2.media_value) {
      (Some(media1), Some(media2)) => {
        if media1.to_lowercase() != media2.to_lowercase() {
          return false;
        }
      }
      (Some(_), None) | (None, Some(_)) => return false,
      (None, None) => {}
    }

    if let (Some(name1), Some(name2)) = (&meta1.name_value, &meta2.name_value) {
      return name1.to_lowercase() == name2.to_lowercase();
    }

    if let (Some(equiv1), Some(equiv2)) = (&meta1.http_equiv_value, &meta2.http_equiv_value) {
      return equiv1.to_lowercase() == equiv2.to_lowercase();
    }

    false
  }

  fn check_against_meta_list(&mut self, meta: &MetaTag, existing_metas: &[MetaTag], context: &str) {
    for existing in existing_metas {
      if Self::are_meta_tags_duplicate(meta, existing) {
        let attribute_description = if let Some(ref name) = meta.name_value {
          format!("`name=\"{}\"`", name)
        } else if let Some(ref http_equiv) = meta.http_equiv_value {
          format!("`http-equiv=\"{}\"`", http_equiv)
        } else {
          return;
        };

        let attribute_type = if meta.name_value.is_some() { "Meta names" } else { "`http-equiv` values" };
        let context_message = if context.is_empty() { String::new() } else { format!(" {}", context) };

        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "Duplicate `<meta>` tag with {}{}. {} should be unique within the `<head>` section.",
            attribute_description, context_message, attribute_type
          ),
          meta.location.clone(),
        ));

        return;
      }
    }
  }

  fn collect_and_check_meta_tag(&mut self, node: &HTMLElementNode) {
    let meta = self.extract_meta_attributes(node);

    if meta.name_value.is_none() && meta.http_equiv_value.is_none() {
      return;
    }

    if self.tracker.is_in_control_flow {
      if self.tracker.current_control_flow_type == Some(ControlFlowType::Loop) {
        self.check_against_meta_list(&meta, &self.tracker.current_branch_values.clone(), "within the same loop iteration");
      } else {
        let branch_metas = self.tracker.current_branch_values.clone();
        let document_metas = self.document_metas.clone();

        self.check_against_meta_list(&meta, &branch_metas, "within the same control flow branch");
        self.check_against_meta_list(&meta, &document_metas, "");

        self.tracker.control_flow_values.push(MetaTag {
          name_value: meta.name_value.clone(),
          http_equiv_value: meta.http_equiv_value.clone(),
          media_value: meta.media_value.clone(),
          location: meta.location.clone(),
        });
      }
    } else {
      let document_metas = self.document_metas.clone();

      self.check_against_meta_list(&meta, &document_metas, "");

      self.document_metas.push(MetaTag {
        name_value: meta.name_value.clone(),
        http_equiv_value: meta.http_equiv_value.clone(),
        media_value: meta.media_value.clone(),
        location: meta.location.clone(),
      });
    }

    self.tracker.current_branch_values.push(meta);
  }
}

impl Visitor for NoDuplicateMetaNamesVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    if let Some(tag_name) = get_tag_name_from_element(node) {
      let lowercase = tag_name.to_lowercase();

      if lowercase == "head" {
        self.document_metas.clear();
        self.tracker = ControlFlowTracker::new();
      } else if lowercase == "meta" && self.element_stack.inside("head") {
        self.collect_and_check_meta_tag(node);
      }

      self.element_stack.push(lowercase);
      self.walk_html_element_node(node);
      self.element_stack.pop();
    }
  }

  impl_control_flow_visitor!(NoDuplicateMetaNamesVisitor, tracker);
}

impl Rule for HTMLNoDuplicateMetaNamesRule {
  fn name(&self) -> &'static str {
    "html-no-duplicate-meta-names"
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }
}

impl ParserRule for HTMLNoDuplicateMetaNamesRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = NoDuplicateMetaNamesVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      element_stack: ElementStack::new(),
      document_metas: Vec::new(),
      tracker: ControlFlowTracker::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
