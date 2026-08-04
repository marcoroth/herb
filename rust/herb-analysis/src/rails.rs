use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Default)]
pub struct Gems {
  pub paths: Vec<String>,
  pub resolved: usize,
  pub missing: Vec<String>,
}

pub fn gem_paths(app_root: &Path) -> Gems {
  let Ok(lockfile) = fs::read_to_string(app_root.join("Gemfile.lock")) else {
    return Gems {
      paths: Vec::new(),
      resolved: 0,
      missing: Vec::new(),
    };
  };

  let roots = gem_roots(app_root);
  let checkout_roots = checkout_roots(app_root);
  let mut paths = Vec::new();
  let mut missing = Vec::new();
  let mut resolved_count = 0;

  for spec in parse_lockfile(&lockfile) {
    let resolved = match &spec.source {
      Source::Registry { version } => roots
        .iter()
        .map(|root| root.join(format!("{}-{version}", spec.name)))
        .find(|path| path.is_dir()),
      Source::Git { repo, revision } => resolve_git(&checkout_roots, repo, revision, &spec.name),
      Source::Path { remote } => {
        let base = app_root.join(remote);

        [base.join(&spec.name), base].into_iter().find(|path| path.is_dir())
      }
    };

    match resolved {
      Some(path) => {
        paths.extend(source_dirs(&path));
        resolved_count += 1;
      }

      None => missing.push(spec.name.clone()),
    }
  }

  paths.sort();
  paths.dedup();
  missing.sort();
  missing.dedup();

  Gems {
    paths,
    resolved: resolved_count,
    missing,
  }
}

fn source_dirs(gem_root: &Path) -> Vec<String> {
  ["lib", "app"]
    .iter()
    .map(|dir| gem_root.join(dir))
    .filter(|path| path.is_dir())
    .map(|path| path.to_string_lossy().to_string())
    .collect()
}

fn resolve_git(roots: &[PathBuf], repo: &str, revision: &str, name: &str) -> Option<PathBuf> {
  let short = &revision[..revision.len().min(12)];

  let exact = roots.iter().map(|root| root.join(format!("{repo}-{short}"))).find(|path| path.is_dir());

  let checkout = exact.or_else(|| {
    roots.iter().find_map(|root| {
      fs::read_dir(root)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .find(|path| path.is_dir() && path.file_name().and_then(|n| n.to_str()).is_some_and(|n| n.starts_with(&format!("{repo}-"))))
    })
  })?;

  [checkout.join(name), checkout].into_iter().find(|path| path.is_dir())
}

enum Source {
  Registry { version: String },
  Git { repo: String, revision: String },
  Path { remote: String },
}

struct Spec {
  name: String,
  source: Source,
}

fn parse_lockfile(lockfile: &str) -> Vec<Spec> {
  let mut specs = Vec::new();
  let mut section = "";
  let mut remote = String::new();
  let mut revision = String::new();

  for line in lockfile.lines() {
    match line.trim_end() {
      "GEM" => (section, remote, revision) = ("GEM", String::new(), String::new()),
      "GIT" => (section, remote, revision) = ("GIT", String::new(), String::new()),
      "PATH" => (section, remote, revision) = ("PATH", String::new(), String::new()),
      other if other.starts_with("  remote: ") => remote = other.trim_start().trim_start_matches("remote: ").to_string(),
      other if other.starts_with("  revision: ") => revision = other.trim_start().trim_start_matches("revision: ").to_string(),
      other => {
        let Some((name, version)) = spec_line(other) else {
          continue;
        };

        let source = match section {
          "GIT" if !revision.is_empty() => Source::Git {
            repo: repo_name(&remote),
            revision: revision.clone(),
          },
          "PATH" => Source::Path { remote: remote.clone() },
          _ => Source::Registry { version },
        };

        specs.push(Spec { name, source });
      }
    }
  }

  specs
}

fn repo_name(remote: &str) -> String {
  remote
    .trim_end_matches('/')
    .rsplit('/')
    .next()
    .unwrap_or(remote)
    .trim_end_matches(".git")
    .to_string()
}

fn spec_line(line: &str) -> Option<(String, String)> {
  if !line.starts_with("    ") || line.starts_with("     ") {
    return None;
  }

  let (name, rest) = line.trim_start().split_once(" (")?;
  let version = rest.strip_suffix(')')?;

  let valid = !name.is_empty() && !version.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');

  valid.then(|| (name.to_string(), version.to_string()))
}

fn checkout_roots(app_root: &Path) -> Vec<PathBuf> {
  gem_roots(app_root)
    .iter()
    .filter_map(|root| root.parent().map(|parent| parent.join("bundler/gems")))
    .filter(|root| root.is_dir())
    .collect()
}

fn gem_roots(app_root: &Path) -> Vec<PathBuf> {
  let mut roots = Vec::new();

  if let Ok(entries) = fs::read_dir(app_root.join("vendor/bundle/ruby")) {
    for entry in entries.flatten() {
      roots.push(entry.path().join("gems"));
    }
  }

  if let Ok(output) = Command::new("gem").arg("env").arg("gemdir").current_dir(app_root).output() {
    if let Ok(dir) = String::from_utf8(output.stdout) {
      roots.push(Path::new(dir.trim()).join("gems"));
    }
  }

  roots.into_iter().filter(|root| root.is_dir()).collect()
}

pub fn route_helpers(app_root: &Path) -> BTreeSet<String> {
  let Ok(source) = fs::read_to_string(app_root.join("config/routes.rb")) else {
    return BTreeSet::new();
  };

  let mut names = BTreeSet::new();
  let mut namespaces: Vec<String> = Vec::new();
  let mut depth_stack: Vec<usize> = Vec::new();

  for line in source.lines() {
    let trimmed = line.trim();

    if trimmed.is_empty() || trimmed.starts_with('#') {
      continue;
    }

    if trimmed == "end" {
      if depth_stack.pop().is_some() {
        namespaces.pop();
      }

      continue;
    }

    let prefix = if namespaces.is_empty() {
      String::new()
    } else {
      format!("{}_", namespaces.join("_"))
    };

    if let Some(namespace) = symbol_after(trimmed, "namespace ") {
      namespaces.push(namespace);
      depth_stack.push(namespaces.len());

      continue;
    }

    if trimmed.starts_with("root ") {
      insert_pair(&mut names, &format!("{prefix}root"));

      continue;
    }

    if let Some(name) = symbol_after(trimmed, "resources ") {
      let singular = singularize(&name);

      insert_pair(&mut names, &format!("{prefix}{name}"));
      insert_pair(&mut names, &format!("{prefix}{singular}"));
      insert_pair(&mut names, &format!("new_{prefix}{singular}"));
      insert_pair(&mut names, &format!("edit_{prefix}{singular}"));
    } else if let Some(name) = symbol_after(trimmed, "resource ") {
      insert_pair(&mut names, &format!("{prefix}{name}"));
      insert_pair(&mut names, &format!("new_{prefix}{name}"));
      insert_pair(&mut names, &format!("edit_{prefix}{name}"));
    }

    if let Some(alias_name) = value_after(trimmed, "as: :") {
      insert_pair(&mut names, &format!("{prefix}{alias_name}"));
    } else if let Some(literal) = literal_path(trimmed) {
      insert_pair(&mut names, &format!("{prefix}{literal}"));
    }
  }

  names
}

fn insert_pair(names: &mut BTreeSet<String>, stem: &str) {
  if stem.is_empty() {
    return;
  }

  names.insert(format!("{stem}_path"));
  names.insert(format!("{stem}_url"));
}

fn symbol_after(line: &str, keyword: &str) -> Option<String> {
  let rest = line.strip_prefix(keyword)?.trim_start();
  let rest = rest.strip_prefix(':')?;

  let name: String = rest.chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '_').collect();

  (!name.is_empty()).then_some(name)
}

fn value_after(line: &str, marker: &str) -> Option<String> {
  let index = line.find(marker)?;
  let rest = &line[index + marker.len()..];

  let name: String = rest.chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '_').collect();

  (!name.is_empty()).then_some(name)
}

fn literal_path(line: &str) -> Option<String> {
  let verb = ["get ", "post ", "put ", "patch ", "delete "].iter().find(|verb| line.starts_with(**verb))?;

  let rest = line[verb.len()..].trim_start();
  let quote = rest.chars().next().filter(|c| *c == '"' || *c == '\'')?;
  let rest = &rest[1..];
  let path = rest.split(quote).next()?;

  let segment = path.trim_matches('/');

  if segment.is_empty() || segment.contains('/') || segment.contains(':') || segment.contains('*') {
    return None;
  }

  segment
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    .then(|| segment.replace('-', "_"))
}

fn singularize(word: &str) -> String {
  if let Some(stem) = word.strip_suffix("ies") {
    return format!("{stem}y");
  }

  for suffix in ["ses", "xes", "zes", "ches", "shes"] {
    if let Some(stem) = word.strip_suffix(suffix) {
      return format!("{stem}{}", &suffix[..suffix.len() - 2]);
    }
  }

  word.strip_suffix('s').map_or_else(|| word.to_string(), str::to_string)
}

pub fn helper_methods(roots: &[String]) -> BTreeMap<String, PathBuf> {
  let mut found = BTreeMap::new();

  for root in roots {
    collect_helper_methods(Path::new(root), &mut found);
  }

  found
}

fn collect_helper_methods(path: &Path, found: &mut BTreeMap<String, PathBuf>) {
  let Ok(entries) = fs::read_dir(path) else {
    return;
  };

  for entry in entries.flatten() {
    let path = entry.path();

    if path.is_dir() {
      collect_helper_methods(&path, found);

      continue;
    }

    if path.extension().is_none_or(|extension| extension != "rb") {
      continue;
    }

    let Ok(source) = fs::read_to_string(&path) else {
      continue;
    };

    if !source.contains("helper_method") {
      continue;
    }

    for line in source.lines() {
      let trimmed = line.trim_start();

      if !trimmed.starts_with("helper_method") {
        continue;
      }

      for name in symbols_in(trimmed) {
        found.entry(name).or_insert_with(|| path.clone());
      }
    }
  }
}

fn symbols_in(line: &str) -> Vec<String> {
  let mut names = Vec::new();
  let mut rest = line;

  while let Some(index) = rest.find(':') {
    rest = &rest[index + 1..];

    if rest.starts_with(':') {
      rest = &rest[1..];

      continue;
    }

    let name: String = rest
      .chars()
      .take_while(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '?' || *c == '!')
      .collect();

    if !name.is_empty() && name.chars().next().is_some_and(|c| c.is_ascii_lowercase() || c == '_') {
      names.push(name);
    }
  }

  names
}
