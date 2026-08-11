//! Run with:
//!   cargo run -p herb-highlighter --example diff_styles

use herb_highlighter::diff_renderer::{DiffRenderOptions, RemovedLineStyle};
use herb_highlighter::highlighter::Highlighter;
use herb_highlighter::themes::THEME_NAMES;

const BEFORE: &str = "<div id=\"gems\">\n  <span class='a'>one</span>\n  <%= render partial: 'gem_card', locals: {gem: gem} %>\n  <img src=\"a.png\">\n</div>";

const AFTER: &str =
  "<div id=\"gems\">\n  <span class=\"a\">one</span>\n  <%= render partial: \"gem_card\", locals: { gem: gem } %>\n  <img src=\"a.png\" alt=\"\">\n</div>";

const STYLES: &[(RemovedLineStyle, &str)] = &[
  (
    RemovedLineStyle::Tint,
    "tint  — removed line washed in the theme's removed background (default)",
  ),
  (RemovedLineStyle::Dim, "dim   — removed line faded, the way context lines are faded"),
  (RemovedLineStyle::None, "none  — no treatment, the - marker carries it alone"),
];

fn heading(text: &str) -> String {
  format!("\x1b[1m{text}\x1b[0m")
}

fn subtle(text: &str) -> String {
  format!("\x1b[90m{text}\x1b[0m")
}

fn main() {
  println!("\n{} {}\n", heading("Removed-line treatments"), subtle("(onedark)"));

  let highlighter = Highlighter::new("onedark").expect("onedark is bundled");

  for (style, label) in STYLES {
    println!("{}\n", subtle(label));

    println!(
      "{}",
      highlighter.highlight_diff(
        "",
        BEFORE,
        AFTER,
        &DiffRenderOptions {
          context_lines: 1,
          wrap_lines: false,
          removed_line_style: *style,
          ..Default::default()
        },
      )
    );

    println!();
  }

  println!("\n{} {}\n", heading("Themes"), subtle("(default tint treatment)"));

  for theme in THEME_NAMES {
    let themed = Highlighter::new(theme).expect("every bundled theme resolves");

    let note = if theme == "simple" { " — no diff colors, markers only" } else { "" };

    println!("{}\n", subtle(&format!("{theme}{note}")));

    println!(
      "{}",
      themed.highlight_diff(
        "",
        BEFORE,
        AFTER,
        &DiffRenderOptions {
          context_lines: 0,
          wrap_lines: false,
          ..Default::default()
        },
      )
    );

    println!();
  }
}
