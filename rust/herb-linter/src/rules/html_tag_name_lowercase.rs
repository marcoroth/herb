use crate::autofix::{close_tag_name, for_each_element_mut, location_matches};
use crate::offense::Offense;
use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::tag_utils::get_open_tag;
use crate::utils::tag_utils::{get_tag_name_from_open_tag, tag_name_location};
use herb::union_types::*;

use herb::nodes::*;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

struct XMLDeclarationChecker {
  has_xml_declaration: bool,
}

impl Visitor for XMLDeclarationChecker {
  fn visit_xml_declaration_node(&mut self, _node: &XMLDeclarationNode) {
    self.has_xml_declaration = true;
  }
}

rule_visitor!(TagNameLowercaseVisitor);

impl TagNameLowercaseVisitor {
  fn check_open_tag(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      let lowercase = tag_name.to_lowercase();
      if tag_name != lowercase {
        let location = tag_name_location(node);

        self.add_offense(
          format!("Opening tag name `<{}>` should be lowercase. Use `<{}>` instead.", tag_name, lowercase),
          location,
        );
      }
    }
  }

  fn check_close_tag(&mut self, node: &HTMLCloseTagNode) {
    if let Some(token) = &node.tag_name {
      let tag_name = &token.value;
      let lowercase = tag_name.to_lowercase();

      if tag_name.as_str() != lowercase {
        self.add_offense(
          format!("Closing tag name `</{}>` should be lowercase. Use `</{}>` instead.", tag_name, lowercase),
          token.location.clone(),
        );
      }
    }
  }
}

impl Visitor for TagNameLowercaseVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    // For SVG elements, only check the SVG tag itself (not children)
    if let Some(tag_name) = node.tag_name.as_ref().map(|token| token.value.as_str()) {
      if tag_name.eq_ignore_ascii_case("svg") {
        if let Some(open_tag) = crate::utils::tag_utils::get_open_tag(node) {
          self.check_open_tag(open_tag);
        }
        if let Some(herb::union_types::ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(close)) =
          &node.close_tag
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

pub struct HTMLTagNameLowercaseRule;

impl Rule for HTMLTagNameLowercaseRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "html-tag-name-lowercase"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.4.0")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn default_exclude(&self) -> &[&str] {
    &["**/*.xml", "**/*.xml.erb"]
  }
}

impl ParserRule for HTMLTagNameLowercaseRule {
  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    // Skip if the file contains an XML declaration
    let mut xml_checker = XMLDeclarationChecker { has_xml_declaration: false };
    xml_checker.visit_document_node(&result.value);
    if xml_checker.has_xml_declaration {
      return Vec::new();
    }

    let mut visitor = TagNameLowercaseVisitor::new(self.name());
    visitor.visit_document_node(&result.value);
    visitor.offenses
  }
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    let mut fixed = false;

    for_each_element_mut(document, &mut |element| {
      let open_matches = get_open_tag(element)
        .and_then(|open_tag| open_tag.tag_name.as_ref())
        .map(|token| location_matches(&token.location, offense))
        .unwrap_or(false);

      let close_matches = close_tag_name(element).map(|token| location_matches(&token.location, offense)).unwrap_or(false);

      if !open_matches && !close_matches {
        return;
      }

      let corrected = if open_matches {
        get_open_tag(element)
          .and_then(|tag| tag.tag_name.as_ref())
          .map(|token| token.value.to_lowercase())
      } else {
        close_tag_name(element).map(|token| token.value.to_lowercase())
      };

      let corrected = match corrected {
        Some(corrected) => corrected,
        None => return,
      };

      if let Some(ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(open_tag)) = element.open_tag.as_mut() {
        if let Some(token) = open_tag.tag_name.as_mut() {
          token.value = corrected.clone();
        }
      }

      if let Some(ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(close_tag)) = element.close_tag.as_mut() {
        if let Some(token) = close_tag.tag_name.as_mut() {
          token.value = corrected;
        }
      }

      fixed = true;
    });

    fixed
  }
}
