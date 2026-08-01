use std::collections::{BTreeMap, HashSet};
use std::env;
use std::path::PathBuf;
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
  oracle: bool,
  gem: Option<String>,
  public_only: bool,
  all_helpers: bool,
  built_ins: bool,
  help: bool,
}

fn main() {
  process::exit(run());
}

fn run() -> i32 {
  let options = parse_args(env::args().collect());

  if options.help || options.command.is_none() {
    show_help();
    return 0;
  }

  match options.command.as_deref() {
    Some("smoke") => smoke(),
    Some("helpers") => helpers(&options),
    Some("ancestors") => ancestors(&options),
    Some("constants") => constants(&options),
    Some("stats") => stats(&options),
    Some("context") => context(&options),
    Some(other) => {
      eprintln!("{}", format!("Unknown command: {other}").red());
      show_help();
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
      "--oracle" => options.oracle = true,
      "--gem" => {
        index += 1;
        options.gem = args.get(index).cloned();
      }
      "--public-only" => options.public_only = true,
      "--all-helpers" => options.all_helpers = true,
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

fn build(options: &CLIOptions) -> Analysis {
  let excluded = HashSet::new();
  let mut analysis = Analysis::index_paths(&options.paths, &excluded);

  if options.built_ins {
    analysis = analysis.with_built_ins();
  }

  analysis.resolve();
  analysis
}

fn smoke() -> i32 {
  let mut analysis = Analysis::index_sources(&[(
    "file:///smoke.rb",
    "module Alpha\n  class Beta\n    def gamma; end\n    def delta(a, b = 1, *rest, key:, **opts, &blk); end\n    def self.epsilon; end\n  end\nend\n",
  )]);

  analysis.resolve();

  let found = analysis.ancestors_of("Alpha::Beta").is_some();
  let methods = analysis.methods_of("Alpha::Beta");

  println!();
  println!(" {}", "E3 — in-memory indexing, no filesystem/Gemfile/bundler".bold());
  println!();
  println!("   Alpha::Beta resolved: {}", pass(found));
  println!("   methods found:        {methods:?}");
  println!();

  i32::from(!found || !methods.contains("gamma"))
}

fn helpers(options: &CLIOptions) -> i32 {
  let analysis = build(options);

  let discovered = if options.all_helpers { analysis.helper_modules() } else { Vec::new() };
  let root_names: Vec<String> = if options.all_helpers { discovered.clone() } else { options.roots.clone() };
  let roots: Vec<&str> = root_names.iter().map(String::as_str).collect();
  let found = analysis.view_visible_helpers(&roots);

  println!();
  println!(
    " {} {}",
    "Helpers".bold(),
    format!("({} files, {} roots)", analysis.files_indexed(), roots.len()).dimmed()
  );
  println!();

  if options.oracle {
    let expected = report::expected(options.gem.as_deref(), options.public_only);

    let diff = herb_analysis::Diff::new(&found, &expected);
    let recall = format!("recall:  {:.1}%", diff.recall() * 100.0);

    println!(
      "   {}",
      format!(
        "registry: {} entries, filtered to gem={} visibility={}",
        action_view_helpers::count(),
        options.gem.as_deref().unwrap_or("*"),
        if options.public_only { "public" } else { "*" }
      )
      .dimmed()
    );
    println!("   oracle:  {}", expected.len());
    println!("   found:   {}", found.len());
    println!("   matched: {}", diff.matched.len());
    println!("   {}", if diff.recall() >= 0.95 { recall.green() } else { recall.red() });
    println!("   extra:   {} {}", diff.extra.len(), "(found but not in oracle)".dimmed());
    println!();
    println!("   {}", "missing:".bold());

    for name in &diff.missing {
      let visibility = action_view_helpers::find_by_name(name).map_or("-", |entry| entry.visibility);

      println!("MISSING\t{name}\t{visibility}");
    }

    println!();
  } else {
    for (method, owner) in found.iter() {
      println!("   {method} {}", format!("— {owner}").dimmed());
    }

    println!();
    println!("   {}", format!("{} total", found.len()).dimmed());
    println!();
  }

  0
}

fn context(options: &CLIOptions) -> i32 {
  let Some(app_root) = options.paths.first().map(PathBuf::from) else {
    eprintln!("{}", "context needs an app path".red());
    return 1;
  };

  let mut roots = vec![app_root.join("app").to_string_lossy().to_string()];
  let gems = rails::gem_paths(&app_root);
  let gem_count = gems.resolved;
  let missing_gems = gems.missing.clone();

  roots.extend(gems.paths);

  let mut analysis = Analysis::index_paths(&roots, &HashSet::new());
  analysis.resolve();

  let helper_modules = analysis.helper_modules();
  let mut module_roots: Vec<&str> = helper_modules.iter().map(String::as_str).collect();

  module_roots.push("ActionView::Base");

  let helpers = analysis.view_visible_helpers(&module_roots);
  let routes = rails::route_helpers(&app_root);

  let app_path = app_root.join("app").to_string_lossy().to_string();
  let mut by_origin: BTreeMap<&str, Vec<(&String, &String)>> = BTreeMap::new();

  for (method, owner) in &helpers {
    let origin = if owner.starts_with("ActionView") || owner.starts_with("ActionDispatch") || owner.starts_with("ActiveSupport") {
      "rails"
    } else if helper_modules.contains(owner) && analysis.is_app_owned(owner, &app_path) {
      "app"
    } else {
      "gem"
    };

    by_origin.entry(origin).or_default().push((method, owner));
  }

  println!();
  println!(
    " {} {}",
    "View context".bold(),
    format!(
      "({} files, {gem_count} gems, {} helper modules)",
      analysis.files_indexed(),
      helper_modules.len()
    )
    .dimmed()
  );
  println!();

  for (origin, mut entries) in by_origin {
    entries.sort();

    println!("   {} {}", origin.bold(), format!("({})", entries.len()).dimmed());

    for (method, owner) in entries {
      println!("     {method} {}", format!("— {owner}").dimmed());
    }

    println!();
  }

  println!("   {} {}", "route".bold(), format!("({}, approximate)", routes.len()).dimmed());

  for name in &routes {
    println!("     {name} {}", "— config/routes.rb".dimmed());
  }

  println!();
  println!("   {}", format!("{} total", helpers.len() + routes.len()).dimmed());

  if !missing_gems.is_empty() {
    println!();
    println!(
      "   {} {}",
      format!("{} locked gems are not installed for this Ruby", missing_gems.len()).yellow(),
      "— their helpers are missing. Run `bundle install` in the app.".dimmed()
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
      None => println!("   {}\n", format!("{target} — did not resolve").red()),
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
  let name = options.name.clone().unwrap_or_default();

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

fn pass(condition: bool) -> ColoredString {
  if condition {
    "yes".green()
  } else {
    "no".red()
  }
}

fn show_help() {
  println!();
  println!(
    " {} {}",
    "herb-analysis".bold(),
    format!("v{VERSION} — rubydex spike, not for production").dimmed()
  );
  println!();
  println!("   smoke                                        in-memory indexing check (E3)");
  println!("   helpers   <paths...> --roots A,B              helper set");
  println!("             [--oracle [--gem G] [--public-only]]  score against the built-in registry");
  println!("   ancestors <paths...> --roots A [--built-ins]  ancestor chain + completeness");
  println!("   constants <paths...> --nesting A::B NAME      lexical constant resolution");
  println!("   stats     <paths...>                          counts and per-phase timings");
  println!("   context   <app-path>                          full ActionView context of a Rails app");
  println!();
  println!("   --all-helpers   discover every *Helper module instead of passing --roots");
  println!();
}
