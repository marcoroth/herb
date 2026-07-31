use crate::offense::Offense;
use crate::utils::html_data::{SVG_CAMEL_CASE_ELEMENTS, SVG_LOWERCASE_TO_CAMELCASE};
use herb::nodes::DocumentNode;

use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::nodes::*;
use herb::union_types::*;
use herb::ParseResult;
use herb::Token;
use herb::Visitor;
use herb_config::{Severity, SeverityConfig};

pub struct SVGTagNameCapitalizationRule;

struct SVGTagNameCapitalizationVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  inside_svg: bool,
}

impl SVGTagNameCapitalizationVisitor {
  fn check_tag_name(&mut self, tag_name_token: &Token, tag_type: &str) {
    let tag_name = &tag_name_token.value;

    if SVG_CAMEL_CASE_ELEMENTS.contains(&tag_name.as_str()) {
      return;
    }

    let lowercase_tag_name = tag_name.to_lowercase();

    if let Some(correct_camel_case) = SVG_LOWERCASE_TO_CAMELCASE.get(&lowercase_tag_name) {
      if tag_name != *correct_camel_case {
        self.offenses.push(UnboundOffense::new(
          self.rule_name,
          format!(
            "{} SVG tag name `{}` should use proper capitalization. Use `{}` instead.",
            tag_type, tag_name, correct_camel_case
          ),
          tag_name_token.location.clone(),
        ));
      }
    }
  }
}

impl Visitor for SVGTagNameCapitalizationVisitor {
  fn visit_html_element_node(&mut self, node: &HTMLElementNode) {
    let tag_name = node.tag_name.as_ref().map(|token| token.value.to_lowercase());

    if tag_name.as_deref() == Some("svg") {
      let was_inside_svg = self.inside_svg;
      self.inside_svg = true;
      self.walk_html_element_node(node);
      self.inside_svg = was_inside_svg;
      return;
    }

    if self.inside_svg {
      if let Some(ref open_tag) = node.open_tag {
        match open_tag {
          ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::HTMLOpenTagNode(open) => {
            if let Some(ref tag_name_token) = open.tag_name {
              self.check_tag_name(tag_name_token, "Opening");
            }
          }

          ERBOpenTagNodeOrHTMLConditionalOpenTagNodeOrHTMLOpenTagNode::ERBOpenTagNode(open) => {
            if let Some(ref tag_name_token) = open.tag_name {
              self.check_tag_name(tag_name_token, "ERB opening");
            }
          }

          _ => {}
        }
      }

      if let Some(ref close_tag) = node.close_tag {
        match close_tag {
          ERBEndNodeOrHTMLCloseTagNodeOrHTMLOmittedCloseTagNodeOrHTMLVirtualCloseTagNode::HTMLCloseTagNode(close) => {
            if let Some(ref tag_name_token) = close.tag_name {
              self.check_tag_name(tag_name_token, "Closing");
            }
          }
          _ => {}
        }
      }
    }

    self.walk_html_element_node(node);
  }
}

impl Rule for SVGTagNameCapitalizationRule {
  fn has_autofix(&self) -> bool {
    true
  }

  fn autocorrectable(&self) -> bool {
    true
  }

  fn name(&self) -> &'static str {
    "svg-tag-name-capitalization"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("0.4.2")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Error)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      action_view_helpers: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

impl ParserRule for SVGTagNameCapitalizationRule {
  fn autofix(&self, offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
    let mut fixed = false;

    crate::autofix::walk_nodes_mut(&mut document.children, &mut |node| {
      let tag_name = match node {
        AnyNode::HTMLOpenTagNode(node) => node.tag_name.as_mut(),
        AnyNode::HTMLCloseTagNode(node) => node.tag_name.as_mut(),
        AnyNode::ERBOpenTagNode(node) => node.tag_name.as_mut(),
        _ => None,
      };

      if let Some(token) = tag_name {
        if !crate::autofix::location_matches(&token.location, offense) {
          return;
        }

        if let Some(correct) = SVG_LOWERCASE_TO_CAMELCASE.get(&token.value.to_lowercase()) {
          token.value = correct.to_string();
          fixed = true;
        }
      }
    });

    fixed
  }

  fn check(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = SVGTagNameCapitalizationVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      inside_svg: false,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
