use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};

use herb::action_view_helpers::{HelperBlockArgument, HelperEntry};
use herb::nodes::{AnyNode, ERBBlockNode, RubyParameterNode};
use herb::prism::PrismNode;
use herb::ParseResult;
use herb::Visitor;
use herb_config::{Framework, Severity, SeverityConfig};

const IGNORED_PREFIX: &str = "_";
const REPORTED_KINDS: &[&str] = &["positional", "rest"];
const MAXIMUM_TAG_SUGGESTION_LENGTH: usize = 60;
const TEMPLATE_DRIVEN_BLOCK: &str = "block_arguments_from_template";

pub struct ERBNoUnusedBlockArgumentRule;

impl Rule for ERBNoUnusedBlockArgumentRule {
  fn name(&self) -> &'static str {
    "erb-no-unused-block-argument"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::PerMode {
      cli: Severity::Error,
      editor: Severity::Info,
    }
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_nodes: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

fn references_name(source: &str, name: &str) -> bool {
  let is_word = |character: char| character.is_ascii_alphanumeric() || character == '_';
  let mut rest = source;
  let mut consumed = 0;

  while let Some(index) = rest.find(name) {
    let start = consumed + index;
    let end = start + name.len();

    let before_ok = start == 0 || !source[..start].chars().next_back().is_some_and(is_word);
    let after_ok = source[end..].chars().next().is_none_or(|character| !is_word(character));

    if before_ok && after_ok {
      return true;
    }

    consumed = start + 1;
    rest = &source[consumed..];
  }

  false
}

macro_rules! collect_erb_content {
  ($($visit:ident, $walk:ident, $node:ident;)*) => {
    $(
      fn $visit(&mut self, node: &herb::nodes::$node) {
        if let Some(content) = node.content.as_ref() {
          self.sources.push(content.value.clone());
        }

        self.$walk(node);
      }
    )*
  };
}

#[derive(Default)]
struct RubySourceCollector {
  sources: Vec<String>,
}

impl Visitor for RubySourceCollector {
  fn visit_ruby_literal_node(&mut self, node: &herb::nodes::RubyLiteralNode) {
    self.sources.push(node.content.clone());

    self.walk_ruby_literal_node(node);
  }

  collect_erb_content! {
    visit_erb_content_node, walk_erb_content_node, ERBContentNode;
    visit_erb_block_node, walk_erb_block_node, ERBBlockNode;
    visit_erb_if_node, walk_erb_if_node, ERBIfNode;
    visit_erb_else_node, walk_erb_else_node, ERBElseNode;
    visit_erb_end_node, walk_erb_end_node, ERBEndNode;
    visit_erb_when_node, walk_erb_when_node, ERBWhenNode;
    visit_erb_case_node, walk_erb_case_node, ERBCaseNode;
    visit_erb_while_node, walk_erb_while_node, ERBWhileNode;
    visit_erb_until_node, walk_erb_until_node, ERBUntilNode;
    visit_erb_for_node, walk_erb_for_node, ERBForNode;
    visit_erb_rescue_node, walk_erb_rescue_node, ERBRescueNode;
    visit_erb_ensure_node, walk_erb_ensure_node, ERBEnsureNode;
    visit_erb_begin_node, walk_erb_begin_node, ERBBeginNode;
    visit_erb_unless_node, walk_erb_unless_node, ERBUnlessNode;
    visit_erb_yield_node, walk_erb_yield_node, ERBYieldNode;
    visit_erb_in_node, walk_erb_in_node, ERBInNode;
    visit_erb_case_match_node, walk_erb_case_match_node, ERBCaseMatchNode;
    visit_erb_render_node, walk_erb_render_node, ERBRenderNode;
    visit_erb_iteration_block_node, walk_erb_iteration_block_node, ERBIterationBlockNode;
    visit_erb_strict_locals_node, walk_erb_strict_locals_node, ERBStrictLocalsNode;
  }
}

fn ruby_source_in_body(node: &ERBBlockNode) -> String {
  let mut collector = RubySourceCollector::default();

  for child in &node.body {
    collector.visit(child);
  }

  if let Some(clause) = node.rescue_clause.as_ref() {
    collector.visit_erb_rescue_node(clause);
  }

  if let Some(clause) = node.else_clause.as_ref() {
    collector.visit_erb_else_node(clause);
  }

  if let Some(clause) = node.ensure_clause.as_ref() {
    collector.visit_erb_ensure_node(clause);
  }

  collector.sources.join("\n")
}

/// The `ParametersNode` of a block, when the block takes only required
/// positional parameters.
fn plain_block_parameters<'node>(call: &'node PrismNode, method: &str) -> Option<&'node PrismNode> {
  if !call.is("CallNode") || call.name.as_deref() != Some(method) || call.has_field("arguments") {
    return None;
  }

  let parameters = call.field_one("block")?.field_one("parameters")?.field_one("parameters")?;

  if !parameters.is("ParametersNode") {
    return None;
  }

  let empty = ["optionals", "posts", "keywords", "rest", "keyword_rest", "block"]
    .iter()
    .all(|field| !parameters.has_field(field));

  if !empty {
    return None;
  }

  Some(parameters)
}

fn each_with_index_argument_name(call: Option<&PrismNode>) -> Option<String> {
  let parameters = plain_block_parameters(call?, "each_with_index")?;
  let requireds = parameters.field("requireds");

  if requireds.len() != 2 || !requireds[1].is("RequiredParameterNode") {
    return None;
  }

  requireds[1].name.clone()
}

fn helper_for(call: Option<&PrismNode>) -> Option<&'static HelperEntry> {
  let call = call?;

  if !call.is("CallNode") {
    return None;
  }

  if let Some(receiver) = call.receiver() {
    if receiver.is("CallNode") && receiver.name.as_deref() == Some("tag") && receiver.receiver().is_none() {
      return herb::action_view_helpers::find_by_name("tag");
    }

    return None;
  }

  herb::action_view_helpers::find_by_name(call.name.as_deref()?)
}

struct Yielded {
  helper: &'static HelperEntry,
  argument: Option<&'static HelperBlockArgument>,
}

fn yielded_argument_for(call: Option<&PrismNode>, name: &str, framework: Option<Framework>) -> Option<Yielded> {
  if framework != Some(Framework::ActionView) {
    return None;
  }

  let helper = helper_for(call)?;

  if !helper.supports_block || helper.special_behaviors.contains(&TEMPLATE_DRIVEN_BLOCK) {
    return None;
  }

  let parameters = call?.field_one("block")?.field_one("parameters")?.field_one("parameters")?;

  if !parameters.is("ParametersNode") {
    return None;
  }

  if parameters.has_field("optionals") || parameters.has_field("posts") || parameters.has_field("rest") {
    return None;
  }

  let requireds = parameters.field("requireds");

  if !requireds.iter().all(|parameter| parameter.is("RequiredParameterNode")) {
    return None;
  }

  let position = requireds.iter().position(|parameter| parameter.name.as_deref() == Some(name))?;

  Some(Yielded {
    helper,
    argument: helper.block_arguments.get(position),
  })
}

fn call_header(source: &str, call: &PrismNode, start: usize, length: usize) -> String {
  if call.name.as_deref() == Some("each_with_index") && !call.has_field("arguments") {
    if let Some((message_start, message_end)) = call.field_location("message_loc") {
      let before = source.get(start..message_start).unwrap_or("");
      let after = source.get(message_end..start + length).unwrap_or("");

      return format!("{before}each{after}");
    }
  }

  source.get(start..start + length).unwrap_or("").to_string()
}

fn tag_without_block_arguments(node: &ERBBlockNode, source: &str) -> Option<String> {
  let call = node.prism()?;

  if !call.is("CallNode") {
    return None;
  }

  let (opening_start, _) = call.field_one("block")?.field_one("parameters")?.field_location("opening_loc")?;

  let start = call.start_offset;

  if opening_start <= start {
    return None;
  }

  let header = call_header(source, call, start, opening_start - start).trim().to_string();

  if header.contains('\n') || !header.ends_with("do") {
    return None;
  }

  let tag_opening = node.tag_opening.as_ref().map(|token| token.value.as_str()).unwrap_or("<%");
  let tag_closing = node.tag_closing.as_ref().map(|token| token.value.as_str()).unwrap_or("%>");

  Some(format!("{tag_opening} {header} {tag_closing}"))
}

fn removal_suggestion(node: &ERBBlockNode, source: &str, drops_every_argument: bool) -> String {
  if drops_every_argument {
    if let Some(tag) = tag_without_block_arguments(node, source) {
      if tag.len() <= MAXIMUM_TAG_SUGGESTION_LENGTH {
        return format!("Remove it and write `{tag}`");
      }
    }
  }

  "Remove it".to_string()
}

struct NoUnusedBlockArgumentVisitor {
  rule_name: &'static str,
  offenses: Vec<UnboundOffense>,
  source: String,
  framework: Option<Framework>,
}

impl NoUnusedBlockArgumentVisitor {
  fn advice_for(&self, node: &ERBBlockNode, name: &str, suggestion: Option<&str>) -> String {
    let underscore = format!("prefix it with an underscore as `_{name}`");
    let yielded = yielded_argument_for(node.prism(), name, self.framework);

    if let Some(yielded) = &yielded {
      if let Some(argument) = yielded.argument {
        return format!("It is the `{}` yielded by `{}`, so {underscore}", argument.argument_type, yielded.helper.name);
      }

      let count = yielded.helper.block_arguments.len();

      let reason = if count == 0 {
        format!("`{}` yields nothing to its block, so it is always `nil`", yielded.helper.name)
      } else {
        format!(
          "`{}` yields {count} argument{}, so it is always `nil`",
          yielded.helper.name,
          if count == 1 { "" } else { "s" }
        )
      };

      return format!("{reason}. {}, or {underscore}", suggestion.unwrap_or("Remove it"));
    }

    match suggestion {
      Some(suggestion) => format!("{suggestion}, or {underscore}"),
      None => format!("Prefix it with an underscore as `_{name}`"),
    }
  }

  fn check_block_arguments(&mut self, node: &ERBBlockNode) {
    let parameters: Vec<&RubyParameterNode> = node
      .block_arguments
      .iter()
      .filter_map(|argument| match argument {
        AnyNode::RubyParameterNode(parameter) => Some(parameter.as_ref()),
        _ => None,
      })
      .collect();

    if parameters.is_empty() {
      return;
    }

    let body_source = ruby_source_in_body(node);
    let reported: Vec<&&RubyParameterNode> = parameters
      .iter()
      .filter(|parameter| REPORTED_KINDS.contains(&parameter.kind.as_str()))
      .collect();

    let removable = !reported.is_empty()
      && reported.iter().all(|parameter| match parameter.name.as_ref() {
        Some(name) => !references_name(&body_source, &name.value),
        None => true,
      });

    let removal = if removable {
      Some(removal_suggestion(node, &self.source, reported.len() == parameters.len()))
    } else {
      None
    };

    let index_argument = if removable { None } else { each_with_index_argument_name(node.prism()) };

    for parameter in &parameters {
      let name = match parameter.name.as_ref() {
        Some(name) => &name.value,
        None => continue,
      };

      if name.starts_with(IGNORED_PREFIX) || !REPORTED_KINDS.contains(&parameter.kind.as_str()) {
        continue;
      }

      if references_name(&body_source, name) {
        continue;
      }

      let each_suggestion = "Use `each` instead of `each_with_index`".to_string();

      let suggestion = removal.clone().or_else(|| {
        if index_argument.as_deref() == Some(name.as_str()) {
          Some(each_suggestion)
        } else {
          None
        }
      });

      let advice = self.advice_for(node, name, suggestion.as_deref());

      self.offenses.push(UnboundOffense::with_tags(
        self.rule_name,
        format!("Block argument `{name}` is never used. {advice} to show it is intentionally unused."),
        parameter.location.clone(),
        vec!["unnecessary".to_string()],
      ));
    }
  }
}

impl Visitor for NoUnusedBlockArgumentVisitor {
  fn visit_erb_block_node(&mut self, node: &ERBBlockNode) {
    self.check_block_arguments(node);

    self.walk_erb_block_node(node);
  }
}

impl ParserRule for ERBNoUnusedBlockArgumentRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() {
      result.source.clone()
    } else {
      context.source.clone()
    };

    let mut visitor = NoUnusedBlockArgumentVisitor {
      rule_name: self.name(),
      offenses: Vec::new(),
      source,
      framework: context.framework,
    };

    visitor.visit_document_node(&result.value);

    visitor.offenses
  }
}
