use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::env;
use std::path::{Path, PathBuf};
use std::process;

use colored::*;

use herb::action_view_helpers;

use herb_analysis::{rails, report, Analysis};

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Default)]
struct CLIOptions {
  command: Option<String>,
  paths: Vec<String>,
  roots: Vec<String>,
  name: Option<String>,
  nesting: Option<String>,
  gem: Option<String>,
  include_internal: bool,
  only: Option<Vec<String>>,
  built_ins: bool,
  help: bool,
  version: bool,
  no_color: bool,
}

fn main() {
  process::exit(run());
}

fn run() -> i32 {
  let options = parse_args(env::args().collect());

  if options.no_color {
    colored::control::set_override(false);
  }

  if options.help || (options.command.is_none() && !options.version) {
    print_usage();

    return 0;
  }

  if options.version {
    println!("herb-analysis {VERSION}");

    return 0;
  }

  match options.command.as_deref() {
    Some("helpers") => helpers(&options),
    Some("audit") => audit(&options),
    Some("ancestors") => ancestors(&options),
    Some("constants") => constants(&options),
    Some("stats") => stats(&options),
    Some(other) => {
      eprintln!("{}", format!("Unknown command: {other}").red());
      print_usage();

      1
    }
    None => 0,
  }
}

fn parse_args(args: Vec<String>) -> CLIOptions {
  let mut options = CLIOptions::default();
  let mut index = 1;

  while index < args.len() {
    let arg = &args[index];

    match arg.as_str() {
      "--help" | "-h" => options.help = true,
      "--version" | "-v" => options.version = true,
      "--no-color" => options.no_color = true,
      "--built-ins" => options.built_ins = true,
      "--roots" => {
        index += 1;
        if let Some(value) = args.get(index) {
          options.roots = value.split(',').map(str::to_string).collect();
        }
      }
      "--nesting" => {
        index += 1;
        options.nesting = args.get(index).cloned();
      }
      "--gem" => {
        index += 1;
        options.gem = args.get(index).cloned();
      }
      "--include-internal" => options.include_internal = true,
      "--only" => {
        index += 1;
        if let Some(value) = args.get(index) {
          options.only = Some(value.split(',').map(str::to_string).collect());
        }
      }
      _ => {
        if options.command.is_none() {
          options.command = Some(arg.clone());
        } else if arg.starts_with('/') || arg.starts_with('.') {
          options.paths.push(arg.clone());
        } else {
          options.name = Some(arg.clone());
        }
      }
    }

    index += 1;
  }

  options
}

fn source_roots(path: &Path) -> (Vec<String>, bool, rails::Gems) {
  if path.join("Gemfile.lock").is_file() {
    let gems = rails::gem_paths(path);
    let mut roots = vec![path.join("app").to_string_lossy().to_string()];

    roots.extend(gems.paths.clone());

    (roots, true, gems)
  } else {
    (vec![path.to_string_lossy().to_string()], false, rails::Gems::default())
  }
}

fn build(options: &CLIOptions) -> Analysis {
  let paths = if options.paths.is_empty() {
    vec![".".to_string()]
  } else {
    options.paths.clone()
  };

  let mut analysis = Analysis::index_paths(&paths, &HashSet::new());

  if options.built_ins {
    analysis = analysis.with_built_ins();
  }

  analysis.resolve();
  analysis
}

fn audit(options: &CLIOptions) -> i32 {
  let raw_root = options.paths.first().map_or_else(|| PathBuf::from("."), PathBuf::from);

  let Ok(path) = raw_root.canonicalize() else {
    eprintln!("{}", format!("no such directory: {}", raw_root.display()).red());
    return 1;
  };

  let (source_paths, _, gems) = source_roots(&path);
  let mut analysis = Analysis::index_paths(&source_paths, &HashSet::new());

  analysis.resolve();

  let exposed = rails::helper_methods(&source_paths);

  let mut root_names = if options.roots.is_empty() {
    analysis.helper_modules()
  } else {
    options.roots.clone()
  };

  root_names.push("ActionView::Base".to_string());

  let roots: Vec<&str> = root_names.iter().map(String::as_str).collect();
  let mut found = analysis.view_visible_helpers(&roots);

  for (name, file) in &exposed {
    found
      .entry(name.clone())
      .or_insert_with(|| format!("helper_method in {}", short_path(file, &path)));
  }

  let expected = report::expected(options.gem.as_deref(), !options.include_internal);
  let diff = herb_analysis::Diff::new(&found, &expected);
  let agreement = format!("{:.1}% of registry entries found", diff.recall() * 100.0);

  println!();
  println!(
    " {} {}",
    "Registry audit".bold(),
    format!(
      "({} files, {} gems, registry gem={} visibility={})",
      analysis.files_indexed(),
      gems.resolved,
      options.gem.as_deref().unwrap_or("*"),
      if options.include_internal { "*" } else { "public" }
    )
    .dimmed()
  );
  println!();
  println!("   {}", format!("compared against {}", describe_roots(&root_names)).dimmed());
  println!();
  println!("   registry entries: {}", expected.len());
  println!("   found in source:  {}", found.len());
  println!("   agreed:           {}", diff.matched.len());
  println!("   {}", if diff.recall() >= 0.95 { agreement.green() } else { agreement.yellow() });
  println!();

  if diff.missing.is_empty() {
    println!("   {}", "no registry entries are unaccounted for".green());
  } else {
    println!(
      "   {} {}",
      "in registry, not found in source".bold(),
      format!("({})", diff.missing.len()).dimmed()
    );
    println!("   {}", "check the `source:` field, or the helper is defined via metaprogramming".dimmed());
    println!();

    for name in &diff.missing {
      let source = action_view_helpers::find_by_name(name).map_or("?", |entry| entry.source);

      println!("     {name} {}", format!("— registry says {source}").dimmed());
      println!("       {}", diagnose(&analysis, source, name, &exposed).dimmed());
    }
  }

  println!();

  if !diff.extra.is_empty() {
    println!(
      "   {} {}",
      "found in source, not in registry".bold(),
      format!("({})", diff.extra.len()).dimmed()
    );
    println!("   {}", "candidates to add, or methods that are not really view-callable".dimmed());
    println!();

    for (name, owner) in diff.extra.iter().take(40) {
      println!("     {name} {}", format!("— {owner}").dimmed());
    }

    if diff.extra.len() > 40 {
      println!("     {}", format!("... and {} more", diff.extra.len() - 40).dimmed());
    }
  }

  println!();

  0
}

const ORIGINS: [&str; 4] = ["app", "gem", "rails", "route"];

fn helpers(options: &CLIOptions) -> i32 {
  let requested = options
    .only
    .clone()
    .unwrap_or_else(|| ORIGINS.iter().map(|origin| (*origin).to_string()).collect());

  for origin in &requested {
    if !ORIGINS.contains(&origin.as_str()) {
      eprintln!("{}", format!("unknown origin `{origin}`, expected one of {}", ORIGINS.join(", ")).red());
      return 1;
    }
  }

  let raw_root = options.paths.first().map_or_else(|| PathBuf::from("."), PathBuf::from);

  let Ok(app_root) = raw_root.canonicalize() else {
    eprintln!("{}", format!("no such directory: {}", raw_root.display()).red());
    return 1;
  };

  let is_rails_app = app_root.join("Gemfile.lock").is_file();
  let has_routes = is_rails_app && app_root.join("config/routes.rb").is_file();

  let routes = if has_routes && requested.iter().any(|origin| origin == "route") {
    rails::route_helpers(&app_root)
  } else {
    BTreeSet::new()
  };

  let needs_index = requested.iter().any(|origin| origin != "route");

  let mut by_origin: BTreeMap<&str, Vec<(String, String)>> = BTreeMap::new();
  let mut summary = String::new();
  let mut missing_gems = Vec::new();

  if needs_index {
    let wants_gems = is_rails_app && requested.iter().any(|origin| origin == "gem" || origin == "rails");
    let gems = if wants_gems { rails::gem_paths(&app_root) } else { rails::Gems::default() };
    let gem_count = if wants_gems { gems.resolved } else { 0 };

    let app_path = if is_rails_app {
      app_root.join("app").to_string_lossy().to_string()
    } else {
      app_root.to_string_lossy().to_string()
    };

    let mut roots = vec![app_path.clone()];

    if wants_gems {
      missing_gems = gems.missing.clone();
      roots.extend(gems.paths);
    }

    let mut analysis = Analysis::index_paths(&roots, &HashSet::new());
    analysis.resolve();

    let helper_modules = if options.roots.is_empty() {
      analysis.helper_modules()
    } else {
      options.roots.clone()
    };

    let mut module_roots: Vec<&str> = helper_modules.iter().map(String::as_str).collect();

    if requested.iter().any(|origin| origin == "rails") {
      module_roots.push("ActionView::Base");
    }

    let mut discovered: Vec<(String, String)> = analysis.view_visible_helpers(&module_roots).into_iter().collect();

    for (name, file) in rails::helper_methods(&roots) {
      discovered.push((name, format!("helper_method in {}", short_path(&file, &app_root))));
    }

    for (method, owner) in discovered {
      let origin = if owner.starts_with("helper_method in ") {
        if owner.contains(&app_path) || !owner.contains("/gems/") {
          "app"
        } else {
          "gem"
        }
      } else if owner.starts_with("ActionView") || owner.starts_with("ActionDispatch") || owner.starts_with("ActiveSupport") {
        "rails"
      } else if helper_modules.contains(&owner) && analysis.is_app_owned(&owner, &app_path) {
        "app"
      } else {
        "gem"
      };

      let origin = if is_rails_app { origin } else { "found" };

      if !is_rails_app || requested.iter().any(|wanted| wanted == origin) {
        by_origin.entry(origin).or_default().push((method, owner));
      }
    }

    summary = if wants_gems {
      format!(
        "{} files, {gem_count} gems, {}",
        analysis.files_indexed(),
        plural(helper_modules.len(), "helper module")
      )
    } else {
      format!("{} files, {}", analysis.files_indexed(), plural(helper_modules.len(), "helper module"))
    };
  }

  println!();

  if summary.is_empty() {
    println!(" {} {}", "Helpers".bold(), "(config/routes.rb only)".dimmed());
  } else {
    println!(" {} {}", "Helpers".bold(), format!("({summary})").dimmed());
  }

  println!();

  let mut total = routes.len();

  if !is_rails_app {
    if let Some(entries) = by_origin.get_mut("found") {
      entries.sort();
      total += entries.len();

      for (method, owner) in entries {
        println!("   {method} {}", format!("— {owner}").dimmed());
      }

      println!();
    }
  }

  for origin in ORIGINS.iter().filter(|origin| is_rails_app && requested.iter().any(|wanted| wanted == *origin)) {
    if *origin == "route" {
      if !has_routes {
        continue;
      }

      println!("   {} {}", "route".bold(), format!("({}, approximate)", routes.len()).dimmed());

      for name in &routes {
        println!("     {name} {}", "— config/routes.rb".dimmed());
      }

      println!();

      continue;
    }

    let Some(entries) = by_origin.get_mut(origin) else {
      continue;
    };

    entries.sort();
    total += entries.len();

    println!("   {} {}", origin.bold(), format!("({})", entries.len()).dimmed());

    for (method, owner) in entries {
      println!("     {method} {}", format!("— {owner}").dimmed());
    }

    println!();
  }

  println!("   {}", format!("{total} total").dimmed());

  if !missing_gems.is_empty() {
    println!();
    println!(
      "   {} {}",
      format!("{} locked gems are not installed for this Ruby", missing_gems.len()).yellow(),
      "so their helpers are missing. Run `bundle install` in the app.".dimmed()
    );
    println!(
      "   {}",
      format!("e.g. {}", missing_gems.iter().take(6).cloned().collect::<Vec<_>>().join(", ")).dimmed()
    );
  }

  println!();

  0
}

fn ancestors(options: &CLIOptions) -> i32 {
  let analysis = build(options);

  let targets: Vec<String> = if options.roots.is_empty() {
    options.name.clone().into_iter().collect()
  } else {
    options.roots.clone()
  };

  if targets.is_empty() {
    eprintln!("{}", "ancestors needs a target, e.g. `ancestors . --roots ApplicationHelper`".red());
    return 1;
  }

  println!();
  println!(
    " {} {}",
    "Ancestors".bold(),
    format!("({} files, built_ins: {})", analysis.files_indexed(), options.built_ins).dimmed()
  );
  println!();

  for target in &targets {
    match analysis.ancestors_of(target) {
      Some(ancestry) => {
        let state = format!("[{}]", ancestry.state.as_str());
        let state = if ancestry.unresolved == 0 { state.green() } else { state.yellow() };

        println!(
          "   {} {} {}",
          target.bold(),
          state,
          format!("{} ancestors, {} unresolved", ancestry.names.len(), ancestry.unresolved).dimmed()
        );

        for name in ancestry.names.iter().take(25) {
          println!("     {}", name.dimmed());
        }

        println!();
      }
      None => println!("   {}\n", format!("{target} did not resolve").red()),
    }
  }

  0
}

fn constants(options: &CLIOptions) -> i32 {
  let analysis = build(options);

  let nesting_owned: Vec<String> = options
    .nesting
    .as_deref()
    .unwrap_or("")
    .split("::")
    .filter(|part| !part.is_empty())
    .map(str::to_string)
    .collect();

  let nesting: Vec<&str> = nesting_owned.iter().map(String::as_str).collect();

  let Some(name) = options.name.clone() else {
    let defined = analysis.constants();

    println!();
    println!(
      " {} {}",
      "Constants".bold(),
      format!("({} files, {})", analysis.files_indexed(), plural(defined.len(), "constant")).dimmed()
    );
    println!();

    for (constant, kind) in &defined {
      println!("   {constant} {}", format!("— {kind}").dimmed());
    }

    println!();

    return 0;
  };

  println!();
  println!(" {}", "Constant resolution".bold());
  println!();
  println!("   nesting: {nesting:?}");
  println!("   name:    {name}");

  match analysis.resolve_constant(&nesting, &name) {
    Some(resolved) => println!("   {}", format!("resolved: {resolved}").green()),
    None => println!("   {}", "unresolved".red()),
  }

  println!();

  0
}

fn stats(options: &CLIOptions) -> i32 {
  let analysis = build(options);

  println!();
  println!(" {}", "Index stats".bold());
  println!();
  println!("   files:        {}", analysis.files_indexed());
  println!("   declarations: {}", analysis.declaration_count());
  println!("   definitions:  {}", analysis.definition_count());
  println!("   errors:       {}", analysis.index_errors().len());
  println!();

  for (phase, duration) in analysis.timings() {
    println!("   {phase:<12} {duration:>8.1?}");
  }

  println!();

  0
}

fn describe_roots(roots: &[String]) -> String {
  let named: Vec<&String> = roots.iter().filter(|root| !root.ends_with("Helper")).collect();
  let helpers = roots.len() - named.len();

  let mut parts: Vec<String> = named.iter().map(|root| (*root).clone()).collect();

  if helpers > 0 {
    parts.push(plural(helpers, "*Helper module"));
  }

  parts.join(" and ")
}

fn diagnose(analysis: &Analysis, source: &str, name: &str, exposed: &BTreeMap<String, PathBuf>) -> String {
  let Some((owner, method)) = source.rsplit_once(['#', '.']) else {
    return "no `source:` recorded".to_string();
  };

  if exposed.contains_key(name) {
    return format!("exposed to views by `helper_method :{name}`, not through the ancestry");
  }

  if !analysis.defines(owner) {
    return format!("{owner} was not indexed, so its gem is probably not installed");
  }

  if analysis.methods_of(owner).contains(method) {
    format!("defined in {owner}, which is not reachable from the roots above")
  } else {
    format!("not defined in {owner}, so the `source:` looks wrong")
  }
}

fn short_path(path: &Path, app_root: &Path) -> String {
  path
    .strip_prefix(app_root)
    .map(|relative| relative.to_string_lossy().to_string())
    .unwrap_or_else(|_| {
      path
        .to_string_lossy()
        .rsplit_once("/gems/")
        .map_or_else(|| path.to_string_lossy().to_string(), |(_, gem)| gem.to_string())
    })
}

fn plural(count: usize, noun: &str) -> String {
  if count == 1 {
    format!("{count} {noun}")
  } else {
    format!("{count} {noun}s")
  }
}

fn print_usage() {
  println!("herb-analysis {VERSION} - Cross-file static analysis for Ruby and Action View");
  println!();
  println!("Usage: herb-analysis <command> [path] [options]");
  println!();
  println!("Arguments:");
  println!("  path             Directory to index, defaults to the current directory");
  println!("                   Must start with . or / so it is not read as a name");
  println!();
  println!("Commands:");
  println!("  helpers          List everything a template can call, grouped by origin");
  println!("  audit            Cross-check Herb's Action View helper registry against real sources");
  println!("  ancestors        Show a module's ancestor chain and whether it is complete");
  println!("  constants        List constants, or resolve one against a lexical nesting");
  println!("  stats            Show index counts and per-phase timings");
  println!();
  println!("Options:");
  println!("  -h, --help                    show help");
  println!("  -v, --version                 show version");
  println!("  --roots <A,B>                 limit to these modules instead of every *Helper module");
  println!("  --only <origins>              limit `helpers` to app, gem, rails, and/or route");
  println!("  --gem <name>                  limit the registry comparison in `audit` to one gem");
  println!("  --include-internal            include registry entries marked internal in `audit`");
  println!("  --nesting <A::B>              lexical nesting to resolve a constant against");
  println!("  --built-ins                   seed core class data before resolving ancestors");
  println!("  --no-color                    disable colored output");
  println!();
  println!("Examples:");
  println!("  herb-analysis helpers                      # everything a template in this app can call");
  println!("  herb-analysis helpers --only app           # just the app's own helpers");
  println!("  herb-analysis helpers ../some/gem          # any directory, listed flat");
  println!("  herb-analysis audit --gem actionview       # check the registry against Action View");
  println!("  herb-analysis ancestors ActionView::Base   # what a view inherits from");
  println!("  herb-analysis constants CONFIG --nesting Admin::UsersController");
}
