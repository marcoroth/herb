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
  let mut resources: Vec<String> = Vec::new();
  let mut resource_depth: Vec<usize> = Vec::new();

  for line in source.lines() {
    let trimmed = line.trim();

    if trimmed.is_empty() || trimmed.starts_with('#') {
      continue;
    }

    if trimmed == "end" {
      if let Some(depth) = depth_stack.pop() {
        namespaces.pop();

        if resource_depth.last() == Some(&depth) {
          resource_depth.pop();
          resources.pop();
        }
      }

      continue;
    }

    let named: Vec<&str> = namespaces.iter().map(String::as_str).filter(|part| !part.is_empty()).collect();

    let prefix = if named.is_empty() {
      String::new()
    } else {
      format!("{}_", named.join("_"))
    };

    if let Some(namespace) = symbol_after(trimmed, "namespace ") {
      namespaces.push(namespace);
      depth_stack.push(namespaces.len());

      continue;
    }

    // `scope module: :events do` opens a block without contributing to the helper name, so it still
    // has to be tracked: otherwise its `end` pops the enclosing resource and every route nested
    // inside loses the parent's prefix. Only `as:` names a scope.
    if trimmed.starts_with("scope ") && trimmed.ends_with(" do") {
      namespaces.push(value_after(trimmed, "as: :").unwrap_or_default());
      depth_stack.push(namespaces.len());

      continue;
    }

    if trimmed.starts_with("root ") {
      insert_pair(&mut names, &format!("{prefix}root"));

      continue;
    }

    // `get :publish, on: :member` names the route after the enclosing resource, so it has to be
    // handled before the generic `as:`/literal-path cases below.
    if let Some(scope) = value_after(trimmed, "on: :") {
      if let Some(action) = symbol_after(trimmed, "get ")
        .or_else(|| symbol_after(trimmed, "post "))
        .or_else(|| symbol_after(trimmed, "patch "))
        .or_else(|| symbol_after(trimmed, "put "))
        .or_else(|| symbol_after(trimmed, "delete "))
      {
        if let Some(owner) = resources.last() {
          // `prefix` already ends with the enclosing resource's singular name, so a member route
          // only needs the action in front of it.
          let stem = if scope == "collection" {
            let outer: String = namespaces[..namespaces.len().saturating_sub(1)].join("_");
            let outer = if outer.is_empty() { String::new() } else { format!("{outer}_") };

            format!("{action}_{outer}{owner}")
          } else {
            format!("{action}_{}", prefix.trim_end_matches('_'))
          };

          insert_pair(&mut names, &stem);
        }

        continue;
      }
    }

    // `member do` and `collection do` name their routes after the enclosing resource without adding
    // anything to the prefix, but they still open a block that has to balance against its `end`.
    if trimmed == "member do" || trimmed == "collection do" {
      namespaces.push(String::new());
      depth_stack.push(namespaces.len());

      continue;
    }

    // A bare `get :talks` inside a resource block is a member route, named exactly as the
    // `on: :member` form above.
    if !resources.is_empty() {
      if let Some(action) = symbol_after(trimmed, "get ")
        .or_else(|| symbol_after(trimmed, "post "))
        .or_else(|| symbol_after(trimmed, "patch "))
        .or_else(|| symbol_after(trimmed, "put "))
        .or_else(|| symbol_after(trimmed, "delete "))
      {
        insert_pair(&mut names, &format!("{action}_{}", prefix.trim_end_matches('_')));

        continue;
      }
    }

    if let Some(name) = symbol_after(trimmed, "resources ") {
      let singular = singularize(&name);

      insert_pair(&mut names, &format!("{prefix}{name}"));
      insert_pair(&mut names, &format!("{prefix}{singular}"));
      insert_pair(&mut names, &format!("new_{prefix}{singular}"));
      insert_pair(&mut names, &format!("edit_{prefix}{singular}"));

      // When a resource name is already singular, Rails suffixes the index route with `_index` so it
      // does not collide with the member route: `resources :map` gives `map_index_path`.
      if singular == name {
        insert_pair(&mut names, &format!("{prefix}{name}_index"));
      }

      // A nested resource is prefixed by its parent's singular name: `resources :talks` inside
      // `resources :profiles do` produces `profile_talks_path`.
      if trimmed.ends_with(" do") {
        namespaces.push(singular.clone());
        depth_stack.push(namespaces.len());
        resources.push(name);
        resource_depth.push(namespaces.len());
      }

      continue;
    } else if let Some(name) = symbol_after(trimmed, "resource ") {
      insert_pair(&mut names, &format!("{prefix}{name}"));
      insert_pair(&mut names, &format!("new_{prefix}{name}"));
      insert_pair(&mut names, &format!("edit_{prefix}{name}"));

      if trimmed.ends_with(" do") {
        namespaces.push(name.clone());
        depth_stack.push(namespaces.len());
        resources.push(name);
        resource_depth.push(namespaces.len());
      }

      continue;
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

  // A dynamic segment or a glob makes the helper name unpredictable, but a multi-segment literal
  // path is fine: `get "/pages/assets"` gives `pages_assets_path`.
  if segment.is_empty() || segment.contains(':') || segment.contains('*') {
    return None;
  }

  segment
    .chars()
    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '/')
    .then(|| segment.replace(['-', '/'], "_"))
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
