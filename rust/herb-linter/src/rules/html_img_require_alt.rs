use crate::offense::UnboundOffense;
use crate::rule::{LintContext, Rule, RuleType};
use crate::utils::tag_utils::{get_tag_name_from_open_tag, has_attribute};
use herb::nodes::HTMLOpenTagNode;
use herb::visitor::Visitor;
use herb::ParseResult;
use herb_config::Severity;

pub struct HTMLImgRequireAltRule;

struct ImgRequireAltVisitor<'rule> {
  rule_name: &'rule str,
  offenses: Vec<UnboundOffense>,
}

impl<'rule> Visitor for ImgRequireAltVisitor<'rule> {
  fn visit_html_open_tag_node(&mut self, node: &HTMLOpenTagNode) {
    if let Some(tag_name) = get_tag_name_from_open_tag(node) {
      if tag_name.eq_ignore_ascii_case("img") && !has_attribute(node, "alt") {
        let location = node
          .tag_name
          .as_ref()
          .map(|token| token.location.clone())
          .unwrap_or_else(|| node.location.clone());

        self.offenses.push(UnboundOffense {
          rule: self.rule_name.to_string(),
          code: self.rule_name.to_string(),
          message: "Missing required `alt` attribute on `<img>` tag. Add `alt=\"\"` for decorative images or `alt=\"description\"` for informative images.".to_string(),
          location,
        });
      }
    }

    self.walk_html_open_tag_node(node);
  }
}

impl Rule for HTMLImgRequireAltRule {
  fn name(&self) -> &str {
    "html-img-require-alt"
  }

  fn rule_type(&self) -> RuleType {
    RuleType::Parser
  }

  fn default_severity(&self) -> Severity {
    Severity::Error
  }

  fn check_parse(&self, result: &ParseResult, _context: &LintContext) -> Vec<UnboundOffense> {
    let mut visitor = ImgRequireAltVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
