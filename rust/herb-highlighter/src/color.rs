use serde::de::Error as _;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::borrow::Cow;
use std::cell::Cell;
use std::env;
use std::fmt;
use std::io::IsTerminal;

use crate::diagnostic::DiagnosticSeverity;

macro_rules! named_colors {
  ($(($variant:ident, $constant:ident, $name:literal, $code:literal)),* $(,)?) => {
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    pub enum NamedColor {
      $($variant,)*
    }

    impl NamedColor {
      pub fn code(&self) -> &'static str {
        match self {
          $(NamedColor::$variant => $code,)*
        }
      }

      pub fn name(&self) -> &'static str {
        match self {
          $(NamedColor::$variant => $name,)*
        }
      }

      pub fn from_name(name: &str) -> Option<NamedColor> {
        match name {
          $($name => Some(NamedColor::$variant),)*
          _ => None,
        }
      }
    }

    pub mod colors {
      $(pub const $constant: &str = $code;)*
    }
  };
}

named_colors![
  (Reset, RESET, "reset", "\x1b[0m"),
  (Bold, BOLD, "bold", "\x1b[1m"),
  (Dim, DIM, "dim", "\x1b[2m"),
  (Black, BLACK, "black", "\x1b[30m"),
  (Red, RED, "red", "\x1b[31m"),
  (Green, GREEN, "green", "\x1b[32m"),
  (Yellow, YELLOW, "yellow", "\x1b[33m"),
  (Blue, BLUE, "blue", "\x1b[34m"),
  (Magenta, MAGENTA, "magenta", "\x1b[35m"),
  (Cyan, CYAN, "cyan", "\x1b[36m"),
  (White, WHITE, "white", "\x1b[37m"),
  (Gray, GRAY, "gray", "\x1b[90m"),
  (BrightRed, BRIGHT_RED, "brightRed", "\x1b[91m"),
  (BrightGreen, BRIGHT_GREEN, "brightGreen", "\x1b[92m"),
  (BrightYellow, BRIGHT_YELLOW, "brightYellow", "\x1b[93m"),
  (BrightBlue, BRIGHT_BLUE, "brightBlue", "\x1b[94m"),
  (BrightMagenta, BRIGHT_MAGENTA, "brightMagenta", "\x1b[95m"),
  (BrightCyan, BRIGHT_CYAN, "brightCyan", "\x1b[96m"),
  (BgBlack, BG_BLACK, "bgBlack", "\x1b[40m"),
  (BgRed, BG_RED, "bgRed", "\x1b[41m"),
  (BgGreen, BG_GREEN, "bgGreen", "\x1b[42m"),
  (BgYellow, BG_YELLOW, "bgYellow", "\x1b[43m"),
  (BgBlue, BG_BLUE, "bgBlue", "\x1b[44m"),
  (BgMagenta, BG_MAGENTA, "bgMagenta", "\x1b[45m"),
  (BgCyan, BG_CYAN, "bgCyan", "\x1b[46m"),
  (BgWhite, BG_WHITE, "bgWhite", "\x1b[47m"),
  (BgGray, BG_GRAY, "bgGray", "\x1b[100m"),
];

thread_local! {
  static COLOR_OVERRIDE: Cell<Option<bool>> = const { Cell::new(None) };
  static TERMINAL_OVERRIDE: Cell<Option<bool>> = const { Cell::new(None) };
}

pub fn is_color_enabled() -> bool {
  COLOR_OVERRIDE
    .with(|override_value| override_value.get())
    .unwrap_or_else(|| env::var_os("NO_COLOR").is_none())
}

pub fn set_color_override(enabled: bool) {
  COLOR_OVERRIDE.with(|override_value| override_value.set(Some(enabled)));
}

pub fn unset_color_override() {
  COLOR_OVERRIDE.with(|override_value| override_value.set(None));
}

pub fn is_terminal() -> bool {
  TERMINAL_OVERRIDE
    .with(|override_value| override_value.get())
    .unwrap_or_else(|| std::io::stdout().is_terminal())
}

pub fn set_terminal_override(is_terminal: bool) {
  TERMINAL_OVERRIDE.with(|override_value| override_value.set(Some(is_terminal)));
}

pub fn unset_terminal_override() {
  TERMINAL_OVERRIDE.with(|override_value| override_value.set(None));
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Color {
  Named(NamedColor),
  Rgb(u8, u8, u8),
}

impl Color {
  pub fn parse(value: &str) -> Option<Color> {
    match value.strip_prefix('#') {
      Some(hex) if hex.len() == 6 => Some(Color::Rgb(
        u8::from_str_radix(&hex[0..2], 16).ok()?,
        u8::from_str_radix(&hex[2..4], 16).ok()?,
        u8::from_str_radix(&hex[4..6], 16).ok()?,
      )),

      Some(_) => None,

      None => NamedColor::from_name(value).map(Color::Named),
    }
  }

  pub fn foreground(&self) -> Cow<'static, str> {
    match self {
      Color::Named(named) => Cow::Borrowed(named.code()),
      Color::Rgb(red, green, blue) => Cow::Owned(format!("\x1b[38;2;{red};{green};{blue}m")),
    }
  }

  pub fn background(&self) -> Cow<'static, str> {
    match self {
      Color::Named(named) => Cow::Borrowed(named.code()),
      Color::Rgb(red, green, blue) => Cow::Owned(format!("\x1b[48;2;{red};{green};{blue}m")),
    }
  }
}

impl From<NamedColor> for Color {
  fn from(named: NamedColor) -> Self {
    Color::Named(named)
  }
}

impl From<&Color> for Color {
  fn from(color: &Color) -> Self {
    *color
  }
}

impl fmt::Display for Color {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      Color::Named(named) => formatter.write_str(named.name()),
      Color::Rgb(red, green, blue) => write!(formatter, "#{red:02X}{green:02X}{blue:02X}"),
    }
  }
}

impl Serialize for Color {
  fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.collect_str(self)
  }
}

impl<'de> Deserialize<'de> for Color {
  fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
    let value = String::deserialize(deserializer)?;

    Color::parse(&value).ok_or_else(|| D::Error::custom(format!("unknown color: {value}")))
  }
}

pub fn colorize(text: &str, color: impl Into<Color>) -> String {
  if !is_color_enabled() {
    return text.to_string();
  }

  format!("{}{}{}", color.into().foreground(), text, colors::RESET)
}

pub fn colorize_with_background(text: &str, color: impl Into<Color>, background_color: impl Into<Color>) -> String {
  if !is_color_enabled() {
    return text.to_string();
  }

  format!("{}{}{}{}", background_color.into().background(), color.into().foreground(), text, colors::RESET)
}

pub fn hyperlink(text: &str, url: &str) -> String {
  if !is_color_enabled() {
    return text.to_string();
  }

  format!("\x1b]8;;{url}\x1b\\{text}\x1b]8;;\x1b\\")
}

pub fn severity_color(severity: DiagnosticSeverity) -> Color {
  match severity {
    DiagnosticSeverity::Error => Color::Named(NamedColor::BrightRed),
    DiagnosticSeverity::Warning => Color::Named(NamedColor::BrightYellow),
    DiagnosticSeverity::Info => Color::Named(NamedColor::Cyan),
    DiagnosticSeverity::Hint => Color::Named(NamedColor::Gray),
  }
}
