use herb_config::{framework_for_gem, framework_from_gems, Framework};

fn gems(names: &[&str]) -> Vec<String> {
  names.iter().map(|name| name.to_string()).collect()
}

#[test]
fn maps_gems_to_the_framework_they_imply() {
  assert_eq!(Some(Framework::ActionView), framework_for_gem("rails"));
  assert_eq!(Some(Framework::ActionView), framework_for_gem("actionview"));
  assert_eq!(Some(Framework::Hanami), framework_for_gem("hanami"));
  assert_eq!(Some(Framework::Sinatra), framework_for_gem("sinatra"));
  assert_eq!(None, framework_for_gem("rake"));
}

#[test]
fn picks_the_framework_from_a_gem_list() {
  assert_eq!(
    Some((Framework::ActionView, "rails".to_string())),
    framework_from_gems(&gems(&["rake", "rails", "puma"]))
  );

  assert_eq!(None, framework_from_gems(&gems(&["rake", "puma"])));
}

#[test]
fn prefers_action_view_when_a_project_depends_on_more_than_one_framework() {
  assert_eq!(
    Some((Framework::ActionView, "rails".to_string())),
    framework_from_gems(&gems(&["sinatra", "rails"]))
  );
}

#[cfg(feature = "prism")]
mod with_parser {
  use herb_config::{detect_framework_from_gemfile, gems_from_gemfile, Config, Framework};
  use std::fs;
  use tempfile::TempDir;

  fn project(files: &[(&str, &str)]) -> TempDir {
    let directory = TempDir::new().expect("temp dir");

    for (name, contents) in files {
      fs::write(directory.path().join(name), contents).expect("write");
    }

    directory
  }

  #[test]
  fn collects_gems_declared_in_blocks_and_ignores_commented_out_ones() {
    let source = "# gem \"rails\"\n\ngroup :development, :test do\n  gem \"rspec-rails\"\nend\n\ngem 'sinatra', '~> 4.0'\n";

    assert_eq!(vec!["rspec-rails".to_string(), "sinatra".to_string()], gems_from_gemfile(source));
  }

  #[test]
  fn ignores_gem_calls_without_a_literal_name() {
    assert_eq!(vec!["rails".to_string()], gems_from_gemfile("gem name\ngem \"rails\"\n"));
  }

  #[test]
  fn returns_no_gems_for_a_gemfile_that_is_not_valid_ruby() {
    assert!(gems_from_gemfile("group :development do").is_empty());
  }

  #[test]
  fn detects_action_view_from_a_gemfile() {
    let directory = project(&[("Gemfile", "source \"https://rubygems.org\"\n\ngem \"rails\", \"~> 8.0\"\n")]);
    let detection = detect_framework_from_gemfile(directory.path()).expect("detection");

    assert_eq!(Framework::ActionView, detection.framework);
    assert_eq!("rails", detection.gem);
    assert_eq!(directory.path().join("Gemfile"), detection.gemfile_path);
  }

  #[test]
  fn falls_back_to_gems_rb() {
    let directory = project(&[("gems.rb", "gem \"hanami\"\n")]);

    assert_eq!(Framework::Hanami, detect_framework_from_gemfile(directory.path()).expect("detection").framework);
  }

  #[test]
  fn detects_nothing_without_a_gemfile_or_without_a_framework_gem() {
    let directory = project(&[]);

    assert_eq!(None, detect_framework_from_gemfile(directory.path()));

    let directory = project(&[("Gemfile", "gem \"rake\"\n")]);

    assert_eq!(None, detect_framework_from_gemfile(directory.path()));
  }

  #[test]
  fn warns_and_suggests_the_detected_framework() {
    let directory = project(&[(".herb.yml", "version: \"0.10.3\"\n"), ("Gemfile", "gem \"rails\"\n")]);
    let config_path = directory.path().join(".herb.yml");
    let detection = detect_framework_from_gemfile(directory.path());
    let warning = Config::missing_framework_warning(&config_path, detection.as_ref());

    assert!(warning.contains("No `framework` set in"));
    assert!(warning.contains("Your Gemfile depends on `rails`"));
    assert!(warning.contains("`framework: actionview`"));
  }

  #[test]
  fn warns_without_a_suggestion_when_nothing_was_detected() {
    let directory = project(&[(".herb.yml", "version: \"0.10.3\"\n")]);
    let warning = Config::missing_framework_warning(&directory.path().join(".herb.yml"), None);

    assert!(warning.contains("Set `framework` to one of `ruby`, `actionview`, `hanami`, or `sinatra`"));
  }

  #[test]
  fn tracks_whether_the_config_file_sets_a_framework() {
    let directory = project(&[(".herb.yml", "version: \"0.10.3\"\n")]);
    let config = Config::load(directory.path(), Some("0.10.3")).expect("config");

    assert!(!config.has_explicit_framework);

    let directory = project(&[(".herb.yml", "version: \"0.10.3\"\nframework: actionview\n")]);
    let config = Config::load(directory.path(), Some("0.10.3")).expect("config");

    assert!(config.has_explicit_framework);
    assert_eq!(Some(Framework::ActionView), config.config.framework);
  }

  #[cfg(feature = "yerba")]
  #[test]
  fn writes_the_detected_framework_into_the_created_config_file() {
    let directory = project(&[("Gemfile", "gem \"rails\"\n")]);
    let config = Config::load_for_cli(directory.path(), Some("0.10.3"), true).expect("config");
    let contents = std::fs::read_to_string(&config.path).expect("config file");

    assert!(contents.contains("framework: actionview"));
    assert!(!contents.contains("# framework: ruby"));
    assert!(config.has_explicit_framework);
    assert_eq!(Some(Framework::ActionView), config.config.framework);
  }

  #[cfg(feature = "yerba")]
  #[test]
  fn leaves_the_framework_commented_out_without_a_gemfile() {
    let directory = project(&[("package.json", "{}")]);
    let config = Config::load_for_cli(directory.path(), Some("0.10.3"), true).expect("config");
    let contents = std::fs::read_to_string(&config.path).expect("config file");

    assert!(contents.contains("# framework: ruby"));
    assert!(!config.has_explicit_framework);
  }
}
