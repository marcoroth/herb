//! The bundled themes are parsed lazily, so a malformed one only surfaces as a panic the first
//! time that theme is used. Loading every one here turns that into a test failure instead.

use std::fs;
use std::path::PathBuf;

use herb_highlighter::{get_theme, Theme, THEME_NAMES};

fn themes_dir() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("themes")
}

#[test]
fn every_bundled_theme_parses() {
  for name in THEME_NAMES {
    let theme = Theme::from_name(name).unwrap_or_else(|| panic!("{name} is listed in THEME_NAMES but Theme::from_name does not know it"));

    get_theme(theme);
  }
}

#[test]
fn the_themes_directory_holds_exactly_the_bundled_themes() {
  let mut names: Vec<String> = fs::read_dir(themes_dir())
    .expect("themes directory")
    .filter_map(|entry| entry.ok())
    .filter_map(|entry| entry.path().file_stem().map(|stem| stem.to_string_lossy().into_owned()))
    .collect();

  names.sort();

  let mut expected: Vec<String> = THEME_NAMES.iter().map(|name| name.to_string()).collect();
  expected.sort();

  assert_eq!(names, expected, "a theme was added or removed without updating THEME_NAMES");
}
