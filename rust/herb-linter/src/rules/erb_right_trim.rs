use crate::autofix::{for_each_erb_mut, location_matches};
use crate::offense::Offense;
use crate::rule::LintContext;
use herb::nodes::DocumentNode;
use herb::nodes::ERBNode;
use herb::Visitor;

rule_visitor!(RightTrimVisitor);
define_parser_rule!(ERBRightTrimRule, "erb-right-trim", Error, RightTrimVisitor,
  autocorrectable: true,
  autofix: autofix,
  introduced_in: "0.7.5"
);

impl Visitor for RightTrimVisitor {
  fn visit_erb_node(&mut self, node: &dyn ERBNode) {
    let token = match node.tag_closing() {
      Some(token) => token,
      None => return,
    };

    if token.value != "=%>" {
      return;
    }

    self.add_offense(
      "Use `-%>` instead of `=%>` for right-trimming. The `=%>` syntax is obscure and not well-supported in most ERB engines.".to_string(),
      token.location.clone(),
    );
  }
}

fn autofix(offense: &Offense, document: &mut DocumentNode, _context: &LintContext) -> bool {
  let mut fixed = false;

  for_each_erb_mut(document, &mut |tokens| {
    let closing = match tokens.tag_closing.as_mut() {
      Some(closing) if location_matches(&closing.location, offense) => closing,
      _ => return,
    };

    match closing.value.as_str() {
      "=%>" => {
        closing.value = "-%>".to_string();
        fixed = true;
      }

      "-%>" => {
        closing.value = "%>".to_string();
        fixed = true;
      }

      _ => {}
    }
  });

  fixed
}
