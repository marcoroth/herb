#[cfg(feature = "color")]
pub(crate) use colored::Colorize;

#[cfg(not(feature = "color"))]
pub(crate) use passthrough::Colorize;

#[cfg(not(feature = "color"))]
mod passthrough {
  macro_rules! passthrough_colorize {
    ($($name:ident),* $(,)?) => {
      #[allow(dead_code)]
      pub(crate) trait Colorize {
        $(fn $name(&self) -> String;)*
      }

      impl<T: AsRef<str> + ?Sized> Colorize for T {
        $(
          fn $name(&self) -> String {
            self.as_ref().to_string()
          }
        )*
      }
    };
  }

  passthrough_colorize![
    black,
    red,
    green,
    yellow,
    blue,
    magenta,
    purple,
    cyan,
    white,
    bright_black,
    bright_red,
    bright_green,
    bright_yellow,
    bright_blue,
    bright_magenta,
    bright_purple,
    bright_cyan,
    bright_white,
    on_black,
    on_red,
    on_green,
    on_yellow,
    on_blue,
    on_magenta,
    on_purple,
    on_cyan,
    on_white,
    normal,
    bold,
    dimmed,
    italic,
    underline,
    blink,
    reversed,
    hidden,
    strikethrough,
    clear,
  ];
}
