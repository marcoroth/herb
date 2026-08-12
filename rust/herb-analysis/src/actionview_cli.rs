use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

use colored::Colorize;

use herb_analysis::partial_index::PartialIndex;
use herb_analysis::project_index::ProjectIndex;
use herb_analysis::render_graph::Verdict;
use herb_analysis::ruby_render_references;
use herb_analysis::state_flow::{FlowNode, StateFlow};

pub fn run(command: &str, arguments: &[String]) -> i32 {
  match command {
    "check" => check(arguments),
    "graph" => graph(arguments),
    "dependencies" => dependencies(arguments),
    "flow" => flow(arguments),
    "context" => context(arguments),
    "signature" => signature(arguments),
    _ => {
      eprintln!("{}", format!("Unknown actionview subcommand: {command}").red());
      print_usage();

      1
    }
  }
}

pub fn print_usage() {
  println!();
  println!("{}", "Herb ActionView Commands".bold());
  println!();
  println!("{}", "Usage:".bold());
  println!("  herb-analysis actionview [subcommand] [path]");
  println!();
  println!("{}", "Subcommands:".bold());
  println!("  check [path]          Check render calls and flag unresolved partials");
  println!("  graph [path]          Show the render graph for a project");
  println!("  dependencies <file>   Show a template's dependency manifest");
  println!("  flow <file> <state>   Trace one piece of state through every partial it reaches");
  println!("  context <partial>     Show what a partial is rendered inside of");
  println!("  signature <partial>   Show the strict locals a partial receives");
  println!();
}

fn project_root(arguments: &[String]) -> PathBuf {
  match arguments.first().map(PathBuf::from) {
    Some(path) if path.is_dir() => path,
    Some(path) if path.is_file() => containing_project(&path),
    _ => std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
  }
}

fn resolve_file(arguments: &[String]) -> Option<PathBuf> {
  let candidate = PathBuf::from(arguments.first()?);

  if candidate.is_file() {
    Some(candidate)
  } else {
    None
  }
}

fn containing_project(file: &Path) -> PathBuf {
  let mut current = file.parent();

  while let Some(directory) = current {
    if directory.join("app").join("views").is_dir() {
      return directory.to_path_buf();
    }

    current = directory.parent();
  }

  file.parent().map(|parent| parent.to_path_buf()).unwrap_or_else(|| PathBuf::from("."))
}

fn relative(path: &str, root: &Path) -> String {
  Path::new(path)
    .strip_prefix(root)
    .map(|rest| rest.display().to_string())
    .unwrap_or_else(|_| path.to_string())
}

fn header(title: &str) {
  println!();
  println!(" {} {}", "Herb".bold(), "\u{1f33f}".normal());
  println!();
  println!(" {}", title.cyan());
  println!();
}

fn plural(count: usize, word: &str) -> String {
  if count == 1 {
    word.to_string()
  } else {
    format!("{word}s")
  }
}

fn nesting_depths(nodes: &[herb_analysis::state_flow::AffectedNode]) -> Vec<usize> {
  let mut stack: Vec<&[usize]> = Vec::new();

  nodes
    .iter()
    .map(|node| {
      let path = node.node_path.as_slice();

      while stack.last().map(|outer| !path_contains(outer, path)).unwrap_or(false) {
        stack.pop();
      }

      let depth = stack.len();
      stack.push(path);

      depth
    })
    .collect()
}

fn path_contains(outer: &[usize], inner: &[usize]) -> bool {
  outer.len() < inner.len() && inner[..outer.len()] == *outer
}

fn one_line(expression: &str, limit: usize) -> String {
  let collapsed = expression.split_whitespace().collect::<Vec<_>>().join(" ");

  if collapsed.chars().count() > limit {
    let truncated: String = collapsed.chars().take(limit - 1).collect();

    format!("{truncated}\u{2026}")
  } else {
    collapsed
  }
}

fn verdict_marker(verdict: Verdict) -> String {
  match verdict {
    Verdict::Always => "\u{2713}".green().to_string(),
    Verdict::Never => "\u{2717}".dimmed().to_string(),
    Verdict::Mixed => "~".yellow().to_string(),
    Verdict::Unknown => "?".dimmed().to_string(),
  }
}

fn check(arguments: &[String]) -> i32 {
  let started = std::time::Instant::now();
  let root = project_root(arguments);
  let index = PartialIndex::build(&root);
  let templates = index.templates().to_vec();

  header(&format!("{}", root.display()));

  let mut unresolved: Vec<(String, String)> = Vec::new();
  let mut rendered: Vec<String> = Vec::new();
  let mut files_with_renders: BTreeSet<String> = BTreeSet::new();
  let mut dynamic_renders = 0usize;

  let flow = StateFlow::new(&root);

  for file in &templates {
    let result = flow.analyze(file);

    for call in &result.render_calls {
      files_with_renders.insert(file.clone());

      let Some(name) = &call.partial else {
        if call.dynamic {
          dynamic_renders += 1;
        }

        continue;
      };

      match index.resolve(name, Some(file)).first() {
        Some(target) => rendered.push(target.clone()),
        None => unresolved.push((relative(file, &root), name.clone())),
      }
    }
  }

  let partials: Vec<String> = templates
    .iter()
    .filter(|file| herb_analysis::partial_resolution::partial_path(file))
    .cloned()
    .collect();

  let ruby_references = ruby_render_references::collect(&root);

  let unused: Vec<&String> = partials
    .iter()
    .filter(|partial| !rendered.contains(partial))
    .filter(|partial| index.partial_name_for(partial).map(|name| !ruby_references.covers(&name)).unwrap_or(true))
    .collect();

  println!(
    " {}",
    format!("Checking render calls in {} {}...", templates.len(), plural(templates.len(), "template")).dimmed()
  );
  println!();

  if !unresolved.is_empty() {
    println!(" {}", "Unresolved render calls:".bold());
    println!();

    for (file, name) in &unresolved {
      println!("   {} {} {}", "\u{2717}".red(), name, format!("in {file}").dimmed());
    }

    println!();
  }

  if !unused.is_empty() {
    println!(" {}", "Partials nothing renders:".bold());
    println!();

    for partial in &unused {
      println!("   {} {}", "~".yellow(), relative(partial, &root).dimmed());
    }

    println!();
  }

  let issues = unresolved.len() + unused.len();

  println!(" {}", separator().dimmed());
  println!();
  println!(" {}", "Summary:".bold());
  println!("  {} {}", label("Version"), herb::herb::version().cyan());
  let with_partial = rendered.len() + unresolved.len();
  let other_renders = 0usize;
  let total_renders = with_partial + dynamic_renders + other_renders;

  println!(
    "  {} {}",
    label("Checked"),
    format!("{} {}", files_with_renders.len(), plural(files_with_renders.len(), "file")).cyan()
  );

  let mut renders_line = format!("{total_renders} total | {with_partial} with partial");

  if dynamic_renders > 0 {
    renders_line.push_str(&format!(" | {dynamic_renders} dynamic"));
  }

  if other_renders > 0 {
    renders_line.push_str(&format!(" | {other_renders} other"));
  }

  println!("  {} {}", label("Renders"), renders_line.cyan());

  let mut partials_line = format!("{} on disk", partials.len());

  if !unresolved.is_empty() {
    partials_line.push_str(&format!(" | {} unresolved", unresolved.len()));
  }

  if !unused.is_empty() {
    partials_line.push_str(&format!(" | {} unused", unused.len()));
  }

  println!("  {} {}", label("Partials"), partials_line.cyan());
  println!(
    "  {} {}",
    label("Ruby"),
    format!(
      "{} {} | {} {}",
      ruby_references.files_scanned,
      plural(ruby_references.files_scanned, "file"),
      ruby_references.names.len() + ruby_references.prefixes.len(),
      plural(ruby_references.names.len() + ruby_references.prefixes.len(), "reference")
    )
    .cyan()
  );
  println!(
    "  {} {}",
    label("Duration"),
    format!("{:.2}ms", started.elapsed().as_secs_f64() * 1000.0).cyan()
  );

  if issues == 0 {
    println!();
    println!(
      " {} {}",
      "\u{2713}".green().bold(),
      "All render calls resolve and all partials are used!".green()
    );
    println!();

    return 0;
  }

  println!();

  1
}

fn separator() -> String {
  "\u{2500}".repeat(60)
}

fn label(text: &str) -> String {
  format!("{text:<12}").dimmed().to_string()
}

fn graph(arguments: &[String]) -> i32 {
  if let Some(file) = resolve_file(arguments) {
    return graph_file(&file);
  }

  let root = project_root(arguments);
  let mut index = PartialIndex::build(&root);
  let templates = index.templates().to_vec();

  header(&format!("{}", root.display()));

  println!(
    " {}",
    format!("Building render graph for {} {}...", templates.len(), plural(templates.len(), "template")).dimmed()
  );

  let (renders, dynamic_prefixes) = collect_renders(&mut index, &templates);
  let ruby_references = ruby_render_references::collect(&root);
  let reachable = reachable_partials(&index, &renders, &ruby_references, &dynamic_prefixes);

  let entry_points: Vec<&String> = templates.iter().filter(|file| !herb_analysis::partial_resolution::partial_path(file)).collect();

  println!();
  println!(" {}", separator().dimmed());
  println!();

  if !entry_points.is_empty() {
    println!(
      " {} {}",
      "Entry points:".bold(),
      format!("({} {})", entry_points.len(), plural(entry_points.len(), "template")).dimmed()
    );

    for file in &entry_points {
      println!();
      println!(" {}", view_relative(file, &index).cyan());

      let children = renders.get(*file).cloned().unwrap_or_default();

      if children.is_empty() {
        println!("   {}", "(no render calls)".dimmed());
      } else {
        print_partial_tree(&children, &renders, &index, &reachable, "   ", &mut BTreeSet::new());
      }
    }
  }

  if !ruby_references.names.is_empty() {
    println!();
    println!(" {}", separator().dimmed());
    println!();
    println!(
      " {} {}",
      "Ruby references:".bold(),
      format!("({} {})", ruby_references.names.len(), plural(ruby_references.names.len(), "partial")).dimmed()
    );

    for reference in &ruby_references.names {
      let resolved = index.resolve(reference, None).first().cloned();
      let status = if resolved.is_some() { "\u{2713}".green() } else { "\u{2717}".red() };

      println!();
      println!("   {} {}", status, reference.bold());
    }
  }

  let partial_names: Vec<String> = index.names().iter().map(|name| name.to_string()).collect();
  let callers = reverse_graph(&renders, &index);

  println!();
  println!(" {}", separator().dimmed());
  println!();
  println!(" {} {}", "Partial usage:".bold(), "(who renders each partial)".dimmed());

  for name in &partial_names {
    let status = if reachable.contains(name) { "\u{2713}".green() } else { "~".yellow() };

    println!();
    println!("   {} {}", status, name);

    let renderers = callers.get(name).cloned().unwrap_or_default();

    if renderers.is_empty() && ruby_references.covers(name) {
      println!("     {} {}", "\u{2514}\u{2500}\u{2500}".dimmed(), format!("rendered by [Ruby] {name}").dimmed());
    } else if renderers.is_empty() {
      println!("     {}", "(not rendered by any file)".dimmed());
    } else {
      for (position, renderer) in renderers.iter().enumerate() {
        let connector = if position == renderers.len() - 1 {
          "\u{2514}\u{2500}\u{2500}"
        } else {
          "\u{251c}\u{2500}\u{2500}"
        };

        println!(
          "     {} {}",
          connector.dimmed(),
          format!("rendered by {}", view_relative(renderer, &index)).dimmed()
        );
      }
    }
  }

  let unreachable: Vec<&String> = partial_names
    .iter()
    .filter(|name| !reachable.contains(*name))
    .filter(|name| !ruby_references.covers(name))
    .collect();

  if !unreachable.is_empty() {
    println!();
    println!(" {}", separator().dimmed());
    println!();
    println!(
      " {} {}",
      "Unreachable partials:".bold(),
      format!("({} {})", unreachable.len(), plural(unreachable.len(), "partial")).dimmed()
    );
    println!();

    for name in &unreachable {
      let file = index.resolve(name, None).first().map(|file| view_relative(file, &index)).unwrap_or_default();

      println!("   {} {} {}", "~".yellow(), name, file.dimmed());
    }
  }

  println!();
  println!(" {}", separator().dimmed());
  println!();
  println!(" {}", "Summary:".bold());
  println!("  {} {}", label("Entry points"), entry_points.len().to_string().cyan());
  println!("  {} {}", label("Partials"), partial_names.len().to_string().cyan());
  println!("  {} {}", label("Reachable"), (partial_names.len() - unreachable.len()).to_string().cyan());
  println!("  {} {}", label("Unreachable"), unreachable.len().to_string().cyan());
  println!();

  0
}

fn view_relative(file: &str, index: &PartialIndex) -> String {
  Path::new(file)
    .strip_prefix(index.view_root())
    .map(|rest| rest.display().to_string())
    .unwrap_or_else(|_| file.to_string())
}

fn reverse_graph(renders: &BTreeMap<String, Vec<String>>, index: &PartialIndex) -> BTreeMap<String, Vec<String>> {
  let mut callers: BTreeMap<String, Vec<String>> = BTreeMap::new();

  for (file, names) in renders {
    for name in names {
      if index.resolve(name, None).first().is_some() {
        callers.entry(name.clone()).or_default().push(file.clone());
      }
    }
  }

  callers
}

fn graph_file(file: &Path) -> i32 {
  let root = containing_project(file);
  let mut index = PartialIndex::build(&root);
  let templates = index.templates().to_vec();
  let path = file.to_str().unwrap_or_default().to_string();

  let (renders, dynamic_prefixes) = collect_renders(&mut index, &templates);
  let ruby_references = ruby_render_references::collect(&root);
  let reachable = reachable_partials(&index, &renders, &ruby_references, &dynamic_prefixes);
  let callers = reverse_graph(&renders, &index);

  println!();
  println!(" {} {}", "Herb".bold(), "\u{1f33f}".normal());
  println!();
  println!(" {}", "Building render graph...".dimmed());
  println!();

  let is_partial = herb_analysis::partial_resolution::partial_path(&path);

  if is_partial {
    let Some(name) = index.partial_name_for(&path) else {
      println!(" {}", "Could not determine a partial name for this file.".red());

      return 1;
    };

    let status = if reachable.contains(&name) { "\u{2713}".green() } else { "~".yellow() };

    println!(" {} {}", status, name.bold());
    println!();

    let renderers = callers.get(&name).cloned().unwrap_or_default();

    if renderers.is_empty() && ruby_references.covers(&name) {
      println!(" {}", "Rendered by:".bold());
      println!("   {} {}", "\u{2514}\u{2500}\u{2500}".dimmed(), "[Ruby code]".dimmed());
    } else if renderers.is_empty() {
      println!(" {}", "Not rendered by any file.".dimmed());
    } else {
      println!(" {}", "Rendered by:".bold());

      for (position, renderer) in renderers.iter().enumerate() {
        let connector = if position == renderers.len() - 1 {
          "\u{2514}\u{2500}\u{2500}"
        } else {
          "\u{251c}\u{2500}\u{2500}"
        };
        let kind = if herb_analysis::partial_resolution::partial_path(renderer) {
          "(partial)"
        } else {
          "(entry point)"
        };

        println!("   {} {} {}", connector.dimmed(), view_relative(renderer, &index).cyan(), kind.dimmed());
      }
    }
  } else {
    println!(" {} {}", view_relative(&path, &index).cyan(), "(entry point)".dimmed());
  }

  let children = renders.get(&path).cloned().unwrap_or_default();

  println!();

  if children.is_empty() {
    println!(" {}", "No render calls in this file.".dimmed());
  } else {
    println!(" {}", "Renders:".bold());
    print_partial_tree(&children, &renders, &index, &reachable, "   ", &mut BTreeSet::new());
  }

  println!();

  0
}

fn collect_renders(index: &mut PartialIndex, templates: &[String]) -> (BTreeMap<String, Vec<String>>, BTreeSet<String>) {
  let mut renders: BTreeMap<String, Vec<String>> = BTreeMap::new();
  let mut prefixes: BTreeSet<String> = BTreeSet::new();
  let flow = StateFlow::new(index.view_root());

  for file in templates {
    let result = flow.analyze(file);
    let mut names: Vec<String> = Vec::new();

    for call in &result.render_calls {
      if let Some(name) = &call.partial {
        if !names.contains(name) {
          names.push(name.clone());
        }
      }

      if let Some(prefix) = &call.dynamic_prefix {
        prefixes.insert(prefix.clone());
      }
    }

    if !names.is_empty() {
      renders.insert(file.clone(), names);
    }
  }

  (renders, prefixes)
}

fn covered_by_prefix(name: &str, prefixes: &BTreeSet<String>) -> bool {
  prefixes.iter().any(|prefix| name.starts_with(&format!("{prefix}/")) || name == prefix)
}

fn reachable_partials(
  index: &PartialIndex,
  renders: &BTreeMap<String, Vec<String>>,
  ruby_references: &ruby_render_references::RubyRenderReferences,
  prefixes: &BTreeSet<String>,
) -> BTreeSet<String> {
  let mut reachable = BTreeSet::new();
  let mut queue: Vec<String> = Vec::new();

  for (file, names) in renders {
    if herb_analysis::partial_resolution::partial_path(file) {
      continue;
    }

    queue.extend(names.clone());
  }

  queue.extend(ruby_references.names.iter().cloned());

  for name in index.names() {
    if covered_by_prefix(name, prefixes) {
      queue.push(name.to_string());
    }
  }

  while let Some(name) = queue.pop() {
    if !reachable.insert(name.clone()) {
      continue;
    }

    let Some(file) = index.resolve(&name, None).first() else {
      continue;
    };

    if let Some(children) = renders.get(file) {
      queue.extend(children.clone());
    }
  }

  reachable
}

fn print_partial_tree(
  names: &[String],
  renders: &BTreeMap<String, Vec<String>>,
  index: &PartialIndex,
  reachable: &BTreeSet<String>,
  indent: &str,
  visited: &mut BTreeSet<String>,
) {
  for (position, name) in names.iter().enumerate() {
    let last = position == names.len() - 1;
    let connector = if last { "\u{2514}\u{2500}\u{2500}" } else { "\u{251c}\u{2500}\u{2500}" };
    let child_indent = if last { "    " } else { "\u{2502}   " };

    let resolved = index.resolve(name, None).first().cloned();

    let status = match &resolved {
      None => "\u{2717}".red(),
      Some(_) if reachable.contains(name) => "\u{2713}".green(),
      Some(_) => "~".yellow(),
    };

    println!("{indent}{connector} {status} {name}");

    let Some(file) = resolved else {
      continue;
    };

    if !visited.insert(name.clone()) {
      continue;
    }

    if let Some(children) = renders.get(&file) {
      print_partial_tree(children, renders, index, reachable, &format!("{indent}{child_indent}"), visited);
    }
  }
}

fn dependencies(arguments: &[String]) -> i32 {
  let Some(file) = resolve_file(arguments) else {
    eprintln!("{}", "Please provide a template path.".red());

    return 1;
  };

  let root = containing_project(&file);
  let flow = StateFlow::new(&root);
  let path = file.to_str().unwrap_or_default().to_string();
  let result = flow.analyze(&path);

  let is_partial = herb_analysis::partial_resolution::partial_path(&path);
  let kind = if is_partial { "(partial)" } else { "(entry point)" };

  println!();
  println!(" {} {}", "Herb".bold(), "\u{1f33f}".normal());
  println!();
  println!(" {} {}", relative(&path, &root).cyan(), kind.dimmed());

  print_list("Instance variables", "(state)", &result.instance_variables);
  print_list("Constants", "", &result.constants);
  print_list("Declared locals", "(strict locals)", &result.locals_declared);

  if !result.locals_received.is_empty() {
    println!();
    println!(" {} {}", "Locals received".bold(), "(from render calls)".dimmed());

    for (name, expression) in &result.locals_received {
      println!("   {} {} {}", name.yellow(), "\u{2190}".dimmed(), expression);
    }
  }

  print_list("Helper calls", "(known)", &result.helper_calls);
  print_list("Unknown calls", "", &result.unknown_calls);

  let states: Vec<String> = result.instance_variables.iter().chain(result.constants.iter()).cloned().collect();

  if !is_partial && !states.is_empty() {
    println!();
    println!(" {} {}", "State flow".bold(), "(which templates are affected by each state change)".dimmed());

    for state in &states {
      let affected = flow.affected_templates(&path, state);

      if affected.is_empty() {
        continue;
      }

      println!();
      println!(
        "   {} {}",
        state.yellow(),
        format!("({} {})", affected.len(), plural(affected.len(), "template")).dimmed()
      );

      for template in &affected {
        println!("     {}", relative(template, &root).dimmed());
      }
    }
  }

  let index = flow.dependency_index(&path);

  if !index.is_empty() {
    println!();
    println!(" {} {}", "Node index".bold(), "(which DOM nodes are affected by each state change)".dimmed());

    for (state, nodes) in &index {
      println!();
      println!(
        "   {} {}",
        state.yellow(),
        format!("({} {})", nodes.len(), plural(nodes.len(), "node")).dimmed()
      );

      for (position, node) in nodes.iter().enumerate() {
        let connector = if position == nodes.len() - 1 {
          "\u{2514}\u{2500}\u{2500}"
        } else {
          "\u{251c}\u{2500}\u{2500}"
        };
        let path_label = node.node_path.iter().map(|index| index.to_string()).collect::<Vec<_>>().join(",");
        let expression = one_line(&node.expression.clone().unwrap_or_default(), 60);

        println!(
          "     {} {} {} {}",
          connector.dimmed(),
          format!("[{path_label}]").dimmed(),
          node.kind,
          expression.dimmed()
        );
      }
    }
  }

  println!();

  0
}

fn print_list(title: &str, note: &str, values: &[String]) {
  if values.is_empty() {
    return;
  }

  println!();

  if note.is_empty() {
    println!(" {}", title.bold());
  } else {
    println!(" {} {}", title.bold(), note.dimmed());
  }

  for value in values {
    println!("   {}", value.yellow());
  }
}

fn flow(arguments: &[String]) -> i32 {
  let Some(file) = resolve_file(arguments) else {
    eprintln!("{}", "Please provide a template path.".red());

    return 1;
  };

  let root = containing_project(&file);
  let state_flow = StateFlow::new(&root);
  let path = file.to_str().unwrap_or_default();

  let result = state_flow.analyze(path);
  let available: Vec<String> = result.instance_variables.iter().chain(result.constants.iter()).cloned().collect();

  let Some(state) = arguments.get(1) else {
    header(&relative(path, &root));
    print_available(&state_flow, path, &available, &root);

    return 0;
  };

  let Some(node) = state_flow.state_flow(path, state) else {
    header(&relative(path, &root));
    println!(" {}", format!("'{state}' is not read by this template.").dimmed());
    println!();
    print_available(&state_flow, path, &available, &root);

    return 1;
  };

  header(&relative(path, &root));

  println!(" {} {}", "State flow".bold(), format!("for {state}").dimmed());
  println!();

  print_flow_node(&node, &root, "", true, true);

  println!();

  0
}

fn print_available(state_flow: &StateFlow, path: &str, available: &[String], root: &Path) {
  if available.is_empty() {
    println!(" {}", "This template does not read any instance variables or constants.".dimmed());
    println!();

    return;
  }

  println!(" {} {}", "Available state".bold(), format!("({} in this template)", available.len()).dimmed());
  println!();

  for name in available {
    let affected = state_flow.affected_templates(path, name);
    let reach = if affected.len() <= 1 {
      "this template only".to_string()
    } else {
      format!("{} templates", affected.len())
    };

    println!("   {} {}", name.yellow(), reach.dimmed());
  }

  println!();
  println!(" {}", "Trace one with:".dimmed());
  println!(
    "   {}",
    format!("herb-analysis actionview flow {} {}", relative(path, root), available[0]).dimmed()
  );
  println!();
}

fn print_flow_node(node: &FlowNode, root: &Path, prefix: &str, last: bool, is_root: bool) {
  if !is_root {
    println!(" {prefix}\u{2502}");
  }

  let connector = if is_root {
    String::new()
  } else if last {
    "\u{2514}\u{2500}\u{2500} ".to_string()
  } else {
    "\u{251c}\u{2500}\u{2500} ".to_string()
  };

  let carried = node.names.iter().map(|name| name.yellow().to_string()).collect::<Vec<_>>().join(", ");

  let via = if node.via.is_empty() {
    String::new()
  } else {
    let pairs: Vec<String> = node.via.iter().map(|(name, expression)| format!("{name}: {expression}")).collect();

    format!(" {}", format!("\u{2190} {}", pairs.join(", ")).dimmed())
  };

  println!(" {prefix}{connector}{} [{carried}]{via}", relative(&node.file, root).cyan());

  let child_prefix = if is_root {
    prefix.to_string()
  } else if last {
    format!("{prefix}    ")
  } else {
    format!("{prefix}\u{2502}   ")
  };

  let depths = nesting_depths(&node.nodes);

  for (index, affected) in node.nodes.iter().enumerate() {
    let expression = one_line(&affected.expression.clone().unwrap_or_default(), 72);
    let location = affected.location.clone().unwrap_or_default();
    let nesting = "  ".repeat(depths[index]);

    println!(
      " {child_prefix}{nesting}{} {} {} {}",
      "\u{00b7}".dimmed(),
      affected.kind,
      expression.dimmed(),
      format!("({location})").dimmed()
    );
  }

  for (index, child) in node.children.iter().enumerate() {
    print_flow_node(child, root, &child_prefix, index == node.children.len() - 1, false);
  }
}

fn context(arguments: &[String]) -> i32 {
  let Some(file) = resolve_file(arguments) else {
    eprintln!("{}", "Please provide a partial path.".red());

    return 1;
  };

  let root = containing_project(&file);
  let mut project = ProjectIndex::new(&root);
  project.index_all();

  let path = file.to_str().unwrap_or_default();

  let Some(graph) = project.graph() else {
    return 1;
  };

  header(&relative(path, &root));

  let partial_context = graph.context_of(path);

  if graph.callers_of(path).is_empty() {
    println!(" {}", "Not rendered by any template.".dimmed());
    println!();

    return 0;
  }

  println!(
    " {} {}",
    "Rendered inside".bold(),
    format!(
      "({} {})",
      partial_context.chains.len(),
      if partial_context.chains.len() == 1 { "path" } else { "paths" }
    )
    .dimmed()
  );
  println!();

  for (index, chain) in partial_context.chains.iter().enumerate() {
    let connector = if index == partial_context.chains.len() - 1 {
      "\u{2514}\u{2500}\u{2500}"
    } else {
      "\u{251c}\u{2500}\u{2500}"
    };
    let trail = if chain.tags.is_empty() {
      "(top level)".dimmed().to_string()
    } else {
      chain.tags.join(" \u{203a} ")
    };
    let times = if chain.occurrences > 1 {
      format!(" \u{00d7}{}", chain.occurrences).dimmed().to_string()
    } else {
      String::new()
    };

    println!("   {} {trail}{times}", connector.dimmed());
  }

  println!();

  if !partial_context.resolved {
    println!(" {}", "Some call sites could not be resolved, so 'never' is reported as unknown.".yellow());
    println!();
  }

  let mut tags: Vec<String> = partial_context.chains.iter().flat_map(|chain| chain.tags.clone()).collect();
  tags.sort();
  tags.dedup();

  if tags.is_empty() {
    return 0;
  }

  println!(" {}", "Verdicts".bold());
  println!();

  for tag in &tags {
    let verdict = partial_context.ancestor_verdict(&[], &[tag.as_str()]);

    println!("   {} {tag} {}", verdict_marker(verdict), verdict.as_str().dimmed());
  }

  println!();

  0
}

fn signature(arguments: &[String]) -> i32 {
  let Some(file) = resolve_file(arguments) else {
    eprintln!("{}", "Please provide a partial path.".red());

    return 1;
  };

  let root = containing_project(&file);
  let mut project = ProjectIndex::new(&root);
  project.index_all();

  let path = file.to_str().unwrap_or_default().to_string();

  let Some(graph) = project.graph() else {
    return 1;
  };

  let inferred = graph.infer_signature(&path);

  header(&relative(&path, &root));

  if inferred.call_site_count == 0 {
    println!(" {}", "Not rendered by any template, so there is nothing to infer.".dimmed());
    println!();

    return 0;
  }

  println!(
    " {} {}",
    "Inferred".bold(),
    format!(
      "(from {} {})",
      inferred.call_site_count,
      if inferred.call_site_count == 1 { "call site" } else { "call sites" }
    )
    .dimmed()
  );
  println!();
  println!("   {}", inferred.strict_locals_declaration());
  println!();

  let declared = project.partials_mut().and_then(|partials| partials.declaration_for_file(&path).cloned());

  let Some(declaration) = declared else {
    return 0;
  };

  if !declaration.has_declaration {
    println!(" {}", "This partial does not declare strict locals yet.".dimmed());
    println!();

    return 0;
  }

  println!(" {}", "Declared".bold());
  println!();

  if !declaration.required_locals().is_empty() {
    println!("   {} {}", "required".dimmed(), declaration.required_locals().join(", "));
  }

  if !declaration.optional_locals().is_empty() {
    println!("   {} {}", "optional".dimmed(), declaration.optional_locals().join(", "));
  }

  println!("   {} {}", "keyword rest".dimmed(), declaration.has_keyword_rest);
  println!();

  let passed: Vec<String> = inferred.locals.iter().map(|local| local.name.clone()).collect();
  let mut declared_names: Vec<String> = declaration
    .required_locals()
    .iter()
    .chain(declaration.optional_locals().iter())
    .map(|name| name.to_string())
    .collect();
  declared_names.sort();

  let undeclared: Vec<&String> = passed.iter().filter(|name| !declared_names.contains(name)).collect();
  let unused: Vec<&String> = declared_names.iter().filter(|name| !passed.contains(name)).collect();

  if !undeclared.is_empty() && !declaration.has_keyword_rest {
    let names: Vec<String> = undeclared.iter().map(|name| name.to_string()).collect();

    println!(" {} {}", "Passed but not declared:".yellow(), names.join(", "));
    println!();
  }

  if !unused.is_empty() {
    let names: Vec<String> = unused.iter().map(|name| name.to_string()).collect();

    println!(" {} {}", "Declared but never passed:".dimmed(), names.join(", "));
    println!();
  }

  0
}
