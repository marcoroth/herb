use std::path::{Path, PathBuf};

use crate::config_schema::Framework;

pub const GEMFILE_NAMES: [&str; 2] = ["Gemfile", "gems.rb"];

pub const FRAMEWORK_GEMS: [(&str, Framework); 5] = [
  ("rails", Framework::ActionView),
  ("actionview", Framework::ActionView),
  ("hanami", Framework::Hanami),
  ("hanami-view", Framework::Hanami),
  ("sinatra", Framework::Sinatra),
];

const FRAMEWORK_PRECEDENCE: [Framework; 3] = [Framework::ActionView, Framework::Hanami, Framework::Sinatra];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FrameworkDetection {
  pub framework: Framework,
  pub gem: String,
  pub gemfile_path: PathBuf,
}

pub fn framework_for_gem(gem: &str) -> Option<Framework> {
  FRAMEWORK_GEMS.iter().find(|(name, _)| *name == gem).map(|(_, framework)| *framework)
}

pub fn framework_from_gems(gems: &[String]) -> Option<(Framework, String)> {
  FRAMEWORK_PRECEDENCE.iter().find_map(|framework| {
    gems
      .iter()
      .find(|gem| framework_for_gem(gem) == Some(*framework))
      .map(|gem| (*framework, gem.clone()))
  })
}

#[cfg(feature = "prism")]
pub fn gems_from_gemfile(source: &str) -> Vec<String> {
  let mut gems = Vec::new();

  let Ok(result) = herb::parse_ruby(source) else {
    return gems;
  };

  let Some(program) = result.program() else {
    return gems;
  };

  collect_gems(&program, &mut gems);

  gems
}

#[cfg(not(feature = "prism"))]
pub fn gems_from_gemfile(_source: &str) -> Vec<String> {
  Vec::new()
}

#[cfg(feature = "prism")]
fn collect_gems(node: &herb::prism::PrismNode, gems: &mut Vec<String>) {
  if node.is("CallNode") && node.name.as_deref() == Some("gem") && node.receiver().is_none() {
    if let Some(gem) = gem_name(node) {
      gems.push(gem);
    }
  }

  for child in &node.children {
    collect_gems(child, gems);
  }
}

#[cfg(feature = "prism")]
fn gem_name(call: &herb::prism::PrismNode) -> Option<String> {
  let arguments = call.children.iter().find(|child| child.is("ArgumentsNode"))?;
  let first_argument = arguments.children.first()?;

  if first_argument.is("StringNode") || first_argument.is("SymbolNode") {
    first_argument.unescaped.clone()
  } else {
    None
  }
}

pub fn detect_framework_from_gemfile(project_path: &Path) -> Option<FrameworkDetection> {
  for gemfile_name in GEMFILE_NAMES {
    let gemfile_path = project_path.join(gemfile_name);

    let Ok(source) = std::fs::read_to_string(&gemfile_path) else {
      continue;
    };

    let (framework, gem) = framework_from_gems(&gems_from_gemfile(&source))?;

    return Some(FrameworkDetection { framework, gem, gemfile_path });
  }

  None
}
