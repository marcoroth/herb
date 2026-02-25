use crate::offense::UnboundOffense;
use crate::rule::{LintContext, Rule, RuleType};
use crate::utils::tag_utils::get_tag_name_from_open_tag;
use herb::nodes::*;
use herb::visitor::Visitor;
use herb::ParseResult;
use herb_config::Severity;

pub struct HTMLTagNameLowercaseRule;

struct XMLDeclarationChecker {
  has_xml_declaration: bool,
}

impl Visitor for XMLDeclarationChecker {
  fn visit_xml_declaration_node(&mut self, _node: &XMLDeclarationNode) {
    self.has_xml_declaration = true;
  }
}

struct TagNameLowercaseVisitor<'rule> {
  rule_name: &'rule str,
  offenses: Vec<UnboundOffense>,
}

impl<'rule> TagNameLowercaseVisitor<'rule> {
  fn check_open_tag(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      let lowercase = tag_name.to_lowercase();
      if tag_name != lowercase {
        let location = node
          .tag_name
          .as_ref()
          .map(|token| token.location.clone())
          .unwrap_or_else(|| node.location.clone());

        self.offenses.push(UnboundOffense {
          rule: self.rule_name.to_string(),
          code: self.rule_name.to_string(),
          message: format!(
            "Opening tag name `<{}>` should be lowercase. Use `<{}>` instead.",
            tag_name, lowercase
          ),
          location,
        });
      }
    }
  }

  fn check_close_tag(&mut self, node: &HTMLCloseTagNode) {
    if let Some(token) = &node.tag_name {
      let tag_name = &token.value;
      let lowercase = tag_name.to_lowercase();

      if tag_name.as_str() != lowercase {
        self.offenses.push(UnboundOffense {
          rule: self.rule_name.to_string(),
          code: self.rule_name.to_string(),
          message: format!(
            "Closing tag name `</{}>` should be lowercase. Use `</{}>` instead.",
            tag_name, lowercase
          ),
          location: token.location.clone(),
        });
      }
    }
  }
}

impl<'rule> Visitor for TagNameLowercaseVisitor<'rule> {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    // For SVG elements, only check the SVG tag itself (not children)
    if let Some(tag_name) = node.tag_name.as_ref().map(|token| token.value.as_str()) {
      if tag_name.eq_ignore_ascii_case("svg") {
        if let Some(open_tag) = crate::utils::tag_utils::get_open_tag(node) {
          self.check_open_tag(open_tag);
        }
        if let Some(
          herb::union_types::HTMLCloseTagNodeOrHTMLOmittedCloseTagNode::HTMLCloseTagNode(close),
        ) = &node.close_tag
        {
          self.check_close_tag(close);
        }
        return;
      }
    }
    self.walk_html_element_node(node);
  }

  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    self.check_open_tag(node);
  }

  fn visit_html_close_tag_node(&mut self, node: &HTMLCloseTagNode) {
    self.check_close_tag(node);
  }
}

impl Rule for HTMLTagNameLowercaseRule {
  fn name(&self) -> &str {
    "html-tag-name-lowercase"
  }

  fn rule_type(&self) -> RuleType {
    RuleType::Parser
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }

  fn default_exclude(&self) -> &[&str] {
    &["**/*.xml", "**/*.xml.erb"]
  }

  fn check_parse(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    // Skip if the file contains an XML declaration
    let mut xml_checker = XMLDeclarationChecker {
      has_xml_declaration: false,
    };
    xml_checker.visit_document_node(&result.value);
    if xml_checker.has_xml_declaration {
      return Vec::new();
    }

    let mut visitor = TagNameLowercaseVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
    };
    visitor.visit_document_node(&result.value);
    visitor.offenses
  }
}
