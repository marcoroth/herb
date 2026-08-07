use crate::offense::UnboundOffense;
use crate::rule::{LintContext, ParserRule, Rule};
use crate::utils::prism_utils::walk_prism;
use crate::utils::source_slice::location_from_offset;

use herb::action_view_helpers::HelperEntry;
use herb::prism::PrismNode;
use herb::ParseResult;
use herb_config::{Severity, SeverityConfig};

const URL_SEGMENTS: &[&str] = &["url", "urls", "uri", "uris"];
const URL_SUFFIXES: &[&str] = &["path", "paths", "href", "link", "links", "options"];

pub struct ActionViewNoImplicitPolymorphicURLRule;

impl Rule for ActionViewNoImplicitPolymorphicURLRule {
  fn name(&self) -> &'static str {
    "actionview-no-implicit-polymorphic-url"
  }

  fn introduced_in(&self) -> Option<&'static str> {
    Some("unreleased")
  }

  fn default_severity(&self) -> SeverityConfig {
    SeverityConfig::Severity(Severity::Info)
  }

  fn parser_options(&self) -> herb::ParserOptions {
    herb::ParserOptions {
      prism_program: true,
      ..crate::rule::default_linter_parser_options()
    }
  }
}

fn argument_position(source: &str) -> Option<usize> {
  match source {
    "first_arg" => Some(0),
    "second_arg" => Some(1),
    "third_arg" => Some(2),
    _ => None,
  }
}

fn url_for_helper(name: &str) -> Option<&'static HelperEntry> {
  herb::action_view_helpers::entries().iter().find(|entry| {
    let matches_name = entry.name == name || entry.aliases.contains(&name);

    matches_name && entry.implicit_attribute.is_some_and(|attribute| attribute.wrapper == "url_for")
  })
}

fn is_url_like_name(name: &str) -> bool {
  let normalized = name.strip_prefix('@').unwrap_or(name).to_lowercase();
  let segments: Vec<&str> = normalized.split('_').collect();
  let last = segments.last().copied().unwrap_or("");

  if segments.iter().any(|segment| URL_SEGMENTS.contains(segment)) {
    return true;
  }

  if URL_SUFFIXES.contains(&last) {
    return true;
  }

  last.ends_with("url") || last.ends_with("uri")
}

fn url_argument(node: &PrismNode) -> Option<(&PrismNode, &'static str)> {
  if !node.is("CallNode") || node.receiver().is_some() {
    return None;
  }

  let helper = url_for_helper(node.name.as_deref()?)?;
  let implicit = helper.implicit_attribute?;

  let arguments = node.field_one("arguments")?.field("arguments");

  if arguments.is_empty() {
    return None;
  }

  let has_block = node.field_one("block").is_some_and(|block| block.is("BlockNode"));
  let source = if has_block {
    implicit.source_with_block.unwrap_or(implicit.source)
  } else {
    implicit.source
  };

  let index = argument_position(source)?;
  let argument = if arguments.len() == 1 { arguments.first() } else { arguments.get(index) }?;

  Some((argument, helper.name))
}

impl ParserRule for ActionViewNoImplicitPolymorphicURLRule {
  fn check(&self, result: &ParseResult, context: &LintContext) -> Vec<UnboundOffense> {
    let source = if context.source.is_empty() {
      result.source.clone()
    } else {
      context.source.clone()
    };

    let program = match result.value.prism() {
      Some(program) if !source.is_empty() => program,
      _ => return Vec::new(),
    };

    let mut offenses = Vec::new();

    walk_prism(program, &mut |node| {
      if let Some((argument, helper_name)) = url_argument(node) {
        if argument.is("InstanceVariableReadNode") && !argument.name.as_deref().is_some_and(is_url_like_name) {
          let variable = source.get(argument.start_offset..argument.end_offset).unwrap_or("");
          let route_helper = format!("{}_path", variable.strip_prefix('@').unwrap_or(variable));

          offenses.push(UnboundOffense::new(
            self.name(),
            format!(
              "Avoid passing `{variable}` directly to `{helper_name}`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use an explicit route helper like `{route_helper}({variable})`, or `polymorphic_path({variable})` when the route has to be resolved from the model."
            ),
            location_from_offset(&source, argument.start_offset, argument.end_offset),
          ));
        }
      }

      true
    });

    offenses
  }
}
