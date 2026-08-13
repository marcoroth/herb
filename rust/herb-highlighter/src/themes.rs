use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

use crate::color::Color;
use crate::error::HighlightError;

const ONEDARK_THEME: &str = include_str!("../themes/onedark.json");
const GITHUB_LIGHT_THEME: &str = include_str!("../themes/github-light.json");
const DRACULA_THEME: &str = include_str!("../themes/dracula.json");
const TOKYO_NIGHT_THEME: &str = include_str!("../themes/tokyo-night.json");
const SIMPLE_THEME: &str = include_str!("../themes/simple.json");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Theme {
  OneDark,
  GithubLight,
  Dracula,
  TokyoNight,
  Simple,
}

impl Theme {
  pub fn as_str(&self) -> &'static str {
    match self {
      Theme::OneDark => "onedark",
      Theme::GithubLight => "github-light",
      Theme::Dracula => "dracula",
      Theme::TokyoNight => "tokyo-night",
      Theme::Simple => "simple",
    }
  }

  pub fn from_name(name: &str) -> Option<Theme> {
    match name {
      "onedark" => Some(Theme::OneDark),
      "github-light" => Some(Theme::GithubLight),
      "dracula" => Some(Theme::Dracula),
      "tokyo-night" => Some(Theme::TokyoNight),
      "simple" => Some(Theme::Simple),
      _ => None,
    }
  }

  fn source(&self) -> &'static str {
    match self {
      Theme::OneDark => ONEDARK_THEME,
      Theme::GithubLight => GITHUB_LIGHT_THEME,
      Theme::Dracula => DRACULA_THEME,
      Theme::TokyoNight => TOKYO_NIGHT_THEME,
      Theme::Simple => SIMPLE_THEME,
    }
  }
}

impl std::fmt::Display for Theme {
  fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    formatter.write_str(self.as_str())
  }
}

pub const THEME_NAMES: [&str; 5] = ["onedark", "github-light", "dracula", "tokyo-night", "simple"];
pub const DEFAULT_THEME: Theme = Theme::OneDark;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub struct ColorScheme {
  pub token_whitespace: Option<Color>,
  pub token_nbsp: Option<Color>,
  pub token_newline: Option<Color>,
  pub token_identifier: Color,

  pub ruby_keyword: Color,

  pub token_html_doctype: Color,

  pub token_html_tag_start: Color,
  pub token_html_tag_start_close: Color,
  pub token_html_tag_end: Color,
  pub token_html_tag_self_close: Color,

  pub token_html_comment_start: Color,
  pub token_html_comment_end: Color,

  pub token_erb_start: Color,
  pub token_erb_content: Color,
  pub token_erb_end: Color,

  pub token_lt: Color,
  pub token_slash: Color,
  pub token_equals: Color,
  pub token_quote: Color,
  pub token_dash: Color,
  pub token_underscore: Color,
  pub token_exclamation: Color,
  pub token_semicolon: Color,
  pub token_colon: Color,
  pub token_percent: Color,
  pub token_ampersand: Color,

  pub token_character: Color,
  pub token_error: Color,
  pub token_eof: Option<Color>,

  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub diff_removed_line_background: Option<Color>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub diff_added_line_background: Option<Color>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub diff_removed_background: Option<Color>,
  #[serde(default, skip_serializing_if = "Option::is_none")]
  pub diff_added_background: Option<Color>,
}

impl ColorScheme {
  pub fn for_token_type(&self, token_type: &str) -> Option<Color> {
    match token_type {
      "TOKEN_WHITESPACE" => self.token_whitespace,
      "TOKEN_NBSP" => self.token_nbsp,
      "TOKEN_NEWLINE" => self.token_newline,
      "TOKEN_IDENTIFIER" => Some(self.token_identifier),
      "TOKEN_HTML_DOCTYPE" => Some(self.token_html_doctype),
      "TOKEN_HTML_TAG_START" => Some(self.token_html_tag_start),
      "TOKEN_HTML_TAG_START_CLOSE" => Some(self.token_html_tag_start_close),
      "TOKEN_HTML_TAG_END" => Some(self.token_html_tag_end),
      "TOKEN_HTML_TAG_SELF_CLOSE" => Some(self.token_html_tag_self_close),
      "TOKEN_HTML_COMMENT_START" => Some(self.token_html_comment_start),
      "TOKEN_HTML_COMMENT_END" => Some(self.token_html_comment_end),
      "TOKEN_ERB_START" => Some(self.token_erb_start),
      "TOKEN_ERB_CONTENT" => Some(self.token_erb_content),
      "TOKEN_ERB_END" => Some(self.token_erb_end),
      "TOKEN_LT" => Some(self.token_lt),
      "TOKEN_SLASH" => Some(self.token_slash),
      "TOKEN_EQUALS" => Some(self.token_equals),
      "TOKEN_QUOTE" => Some(self.token_quote),
      "TOKEN_DASH" => Some(self.token_dash),
      "TOKEN_UNDERSCORE" => Some(self.token_underscore),
      "TOKEN_EXCLAMATION" => Some(self.token_exclamation),
      "TOKEN_SEMICOLON" => Some(self.token_semicolon),
      "TOKEN_COLON" => Some(self.token_colon),
      "TOKEN_PERCENT" => Some(self.token_percent),
      "TOKEN_AMPERSAND" => Some(self.token_ampersand),
      "TOKEN_CHARACTER" => Some(self.token_character),
      "TOKEN_ERROR" => Some(self.token_error),
      "TOKEN_EOF" => self.token_eof,
      _ => None,
    }
  }
}

pub const OPTIONAL_COLOR_SCHEME_KEYS: &[&str] = &[
  "DIFF_REMOVED_LINE_BACKGROUND",
  "DIFF_ADDED_LINE_BACKGROUND",
  "DIFF_REMOVED_BACKGROUND",
  "DIFF_ADDED_BACKGROUND",
];

pub const REQUIRED_COLOR_SCHEME_KEYS: &[&str] = &[
  "TOKEN_WHITESPACE",
  "TOKEN_NBSP",
  "TOKEN_NEWLINE",
  "TOKEN_IDENTIFIER",
  "RUBY_KEYWORD",
  "TOKEN_HTML_DOCTYPE",
  "TOKEN_HTML_TAG_START",
  "TOKEN_HTML_TAG_START_CLOSE",
  "TOKEN_HTML_TAG_END",
  "TOKEN_HTML_TAG_SELF_CLOSE",
  "TOKEN_HTML_COMMENT_START",
  "TOKEN_HTML_COMMENT_END",
  "TOKEN_ERB_START",
  "TOKEN_ERB_CONTENT",
  "TOKEN_ERB_END",
  "TOKEN_LT",
  "TOKEN_SLASH",
  "TOKEN_EQUALS",
  "TOKEN_QUOTE",
  "TOKEN_DASH",
  "TOKEN_UNDERSCORE",
  "TOKEN_EXCLAMATION",
  "TOKEN_SEMICOLON",
  "TOKEN_COLON",
  "TOKEN_PERCENT",
  "TOKEN_AMPERSAND",
  "TOKEN_CHARACTER",
  "TOKEN_ERROR",
  "TOKEN_EOF",
];

pub fn is_valid_theme(theme: &str) -> bool {
  THEME_NAMES.contains(&theme)
}

pub fn get_theme_names() -> &'static [&'static str] {
  &THEME_NAMES
}

pub fn get_theme(theme: Theme) -> &'static ColorScheme {
  fn load(source: &'static str, name: &str) -> ColorScheme {
    serde_json::from_str(source).unwrap_or_else(|error| panic!("Bundled theme {name} is not a valid color scheme: {error}"))
  }

  static ONEDARK: OnceLock<ColorScheme> = OnceLock::new();
  static GITHUB_LIGHT: OnceLock<ColorScheme> = OnceLock::new();
  static DRACULA: OnceLock<ColorScheme> = OnceLock::new();
  static TOKYO_NIGHT: OnceLock<ColorScheme> = OnceLock::new();
  static SIMPLE: OnceLock<ColorScheme> = OnceLock::new();

  let cell = match theme {
    Theme::OneDark => &ONEDARK,
    Theme::GithubLight => &GITHUB_LIGHT,
    Theme::Dracula => &DRACULA,
    Theme::TokyoNight => &TOKYO_NIGHT,
    Theme::Simple => &SIMPLE,
  };

  cell.get_or_init(|| load(theme.source(), theme.as_str()))
}

pub fn get_default_theme() -> Theme {
  DEFAULT_THEME
}

pub fn load_custom_theme(theme_path: &str) -> Result<ColorScheme, HighlightError> {
  load_custom_theme_inner(theme_path).map_err(|error| HighlightError::new(format!("Failed to load custom theme from {theme_path}: {error}")))
}

fn load_custom_theme_inner(theme_path: &str) -> Result<ColorScheme, String> {
  let theme_content = fs::read_to_string(Path::new(theme_path)).map_err(|error| error.to_string())?;

  let keys: serde_json::Map<String, serde_json::Value> = serde_json::from_str(&theme_content).map_err(|error| error.to_string())?;

  let missing_keys: Vec<&str> = REQUIRED_COLOR_SCHEME_KEYS.iter().copied().filter(|key| !keys.contains_key(*key)).collect();

  if !missing_keys.is_empty() {
    return Err(format!("Custom theme is missing required properties: {}", missing_keys.join(", ")));
  }

  serde_json::from_str(&theme_content).map_err(|error| error.to_string())
}

pub fn resolve_theme(theme_input: &str) -> Result<ColorScheme, HighlightError> {
  match Theme::from_name(theme_input) {
    Some(theme) => Ok(get_theme(theme).clone()),
    None => load_custom_theme(theme_input),
  }
}

pub fn is_custom_theme(theme_input: &str) -> bool {
  !is_valid_theme(theme_input)
}
