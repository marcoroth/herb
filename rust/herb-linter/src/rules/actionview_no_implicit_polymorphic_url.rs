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

const NON_MODEL_RECEIVERS: &[&str] = &[
  "request",
  "response",
  "session",
  "params",
  "cookies",
  "flash",
  "controller",
  "helpers",
  "main_app",
];

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

fn is_identifier(name: &str) -> bool {
  let mut characters = name.chars();

  match characters.next() {
    Some(first) if first.is_ascii_lowercase() || first == '_' => {}
    _ => return false,
  }

  characters.all(|character| character.is_ascii_alphanumeric() || character == '_')
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

fn variable_name(node: &PrismNode) -> Option<String> {
  if node.is("InstanceVariableReadNode") || node.is("LocalVariableReadNode") {
    return node.name.clone();
  }

  None
}

fn literal_segment(node: &PrismNode) -> Option<String> {
  if !node.is("SymbolNode") && !node.is("StringNode") {
    return None;
  }

  node.unescaped.clone().filter(|name| is_identifier(name))
}

fn route_call(route_helper: &str, route_arguments: &[String]) -> String {
  if route_arguments.is_empty() {
    route_helper.to_string()
  } else {
    format!("{route_helper}({})", route_arguments.join(", "))
  }
}

fn is_non_model_receiver(node: &PrismNode) -> bool {
  if !node.is("CallNode") || node.receiver().is_some() {
    return false;
  }

  node.name.as_deref().is_some_and(|name| NON_MODEL_RECEIVERS.contains(&name))
}

/// A plain reader on a model, such as `post.author`, which still resolves to a
/// route polymorphically.
fn is_model_reader_call(node: &PrismNode) -> bool {
  if !node.is("CallNode") || node.has_field("arguments") || node.has_field("block") {
    return false;
  }

  let receiver = match node.receiver() {
    Some(receiver) => receiver,
    None => return false,
  };

  let name = match node.name.as_deref() {
    Some(name) => name,
    None => return false,
  };

  if !is_identifier(name) || is_url_like_name(name) {
    return false;
  }

  !is_non_model_receiver(receiver)
}

fn route_parts(node: &PrismNode) -> Vec<&PrismNode> {
  node.field("elements").iter().filter(|element| !element.is("NilNode")).collect()
}

fn route_call_for_array(elements: &[&PrismNode]) -> Option<String> {
  let mut segments = Vec::new();
  let mut route_arguments = Vec::new();

  for element in elements {
    if let Some(literal) = literal_segment(element) {
      segments.push(literal);
      continue;
    }

    let name = variable_name(element)?;

    segments.push(name.strip_prefix('@').unwrap_or(&name).to_string());
    route_arguments.push(name);
  }

  Some(route_call(&format!("{}_path", segments.join("_")), &route_arguments))
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

struct ImplicitUrl {
  start_offset: usize,
  end_offset: usize,
  helper_name: &'static str,
  route_call: Option<String>,
  routable: bool,
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

    let mut urls: Vec<ImplicitUrl> = Vec::new();

    walk_prism(program, &mut |node| {
      if let Some((argument, helper_name)) = url_argument(node) {
        if let Some(name) = variable_name(argument).filter(|name| !is_url_like_name(name)) {
          let stripped = name.strip_prefix('@').unwrap_or(&name).to_string();

          urls.push(ImplicitUrl {
            start_offset: argument.start_offset,
            end_offset: argument.end_offset,
            helper_name,
            route_call: Some(route_call(&format!("{stripped}_path"), &[name.clone()])),
            routable: true,
          });
        }

        if argument.is("ArrayNode") {
          let parts = route_parts(argument);

          urls.push(ImplicitUrl {
            start_offset: argument.start_offset,
            end_offset: argument.end_offset,
            helper_name,
            route_call: if parts.is_empty() { None } else { route_call_for_array(&parts) },
            routable: !parts.is_empty(),
          });
        }

        if is_model_reader_call(argument) {
          urls.push(ImplicitUrl {
            start_offset: argument.start_offset,
            end_offset: argument.end_offset,
            helper_name,
            route_call: None,
            routable: true,
          });
        }
      }

      true
    });

    urls
      .into_iter()
      .map(|url| {
        let value = source.get(url.start_offset..url.end_offset).unwrap_or("");
        let location = location_from_offset(&source, url.start_offset, url.end_offset);

        if !url.routable {
          return UnboundOffense::with_severity(
            self.name(),
            format!(
              "Passing `{value}` to `{}` raises `ArgumentError: Nil location provided. Can't build URI.` at runtime. Rails compacts the Array before it resolves the route, and an Array with nothing left in it has no route to resolve. Use an explicit route helper for the route this link points at.",
              url.helper_name
            ),
            location,
            Severity::Error,
          );
        }

        let suggestion = match &url.route_call {
          Some(route_call) => format!("an explicit route helper like `{route_call}`"),
          None => "an explicit route helper".to_string(),
        };

        UnboundOffense::new(
          self.name(),
          format!(
            "Avoid passing `{value}` directly to `{}`. The URL is resolved implicitly through polymorphic routing, so what actually gets rendered can't be read off the template or traced by tooling. Use {suggestion}, or `polymorphic_path({value})` when the route has to be resolved from the model.",
            url.helper_name
          ),
          location,
        )
      })
      .collect()
  }
}
