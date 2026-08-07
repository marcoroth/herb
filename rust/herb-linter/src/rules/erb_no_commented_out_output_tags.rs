use herb::nodes::ERBContentNode;
use herb::Visitor;

rule_visitor!(CommentedOutOutputTagsVisitor);
define_parser_rule!(
  ERBNoCommentedOutOutputTagsRule,
  "erb-no-commented-out-output-tags",
  Info,
  CommentedOutOutputTagsVisitor,
  introduced_in: "0.10.3"
);

fn commented_out_output_tag(value: &str) -> Option<(String, String)> {
  let trimmed = value.trim_start_matches([' ', '\t']);
  let leading = &value[..value.len() - trimmed.len()];

  let equals: String = trimmed.chars().take_while(|character| *character == '=').collect();

  if equals.is_empty() || equals.len() > 2 {
    return None;
  }

  if trimmed[equals.len()..].starts_with('=') {
    return None;
  }

  Some((format!("{leading}{equals}"), equals))
}

impl Visitor for CommentedOutOutputTagsVisitor {
  fn visit_erb_content_node(&mut self, node: &ERBContentNode) {
    let opening = match node.tag_opening.as_ref() {
      Some(token) => &token.value,
      None => return,
    };

    if opening != "<%#" {
      return;
    }

    let value = match node.content.as_ref() {
      Some(token) => &token.value,
      None => return,
    };

    let (matched, equals) = match commented_out_output_tag(value) {
      Some(parts) => parts,
      None => return,
    };

    self.offenses.push(crate::offense::UnboundOffense::with_tags(
      self.rule_name,
      format!("`<%#{matched}` looks like a temporarily commented ERB output tag. Remove it, or restore it to `<%{equals}` if it's still needed."),
      node.location.clone(),
      vec!["unnecessary".to_string()],
    ));
  }
}
