//! Run with:
//!   cargo run -p herb-highlighter --example diff_view

use herb_highlighter::diff_renderer::{DiffLayout, DiffRenderOptions, SingleLineStyle};
use herb_highlighter::highlighter::Highlighter;

struct Example {
  title: &'static str,
  note: &'static str,
  before: &'static str,
  after: &'static str,
}

const EXAMPLES: &[Example] = &[
  Example {
    title: "Attribute quotes",
    note: "single-line edit, only the two quote characters are marked",
    before: "<div id=\"gems\">\n  <span class='card'>Hello</span>\n</div>",
    after: "<div id=\"gems\">\n  <span class=\"card\">Hello</span>\n</div>",
  },
  Example {
    title: "Missing alt attribute",
    note: "pure insertion, nothing is marked on the removed side",
    before: "<div id=\"gems\">\n  <img src=\"a.png\">\n</div>",
    after: "<div id=\"gems\">\n  <img src=\"a.png\" alt=\"\">\n</div>",
  },
  Example {
    title: "Re-indent a block",
    note: "three lines for three, the inserted indentation is marked on each",
    before: "<div>\n<span>one</span>\n<span>two</span>\n<span>three</span>\n</div>",
    after: "<div>\n  <span>one</span>\n  <span>two</span>\n  <span>three</span>\n</div>",
  },
  Example {
    title: "Wrap content in a new element",
    note: "one line removed, three added",
    before: "<div>\n  <span>content</span>\n</div>",
    after: "<div>\n  <section>\n    <span>content</span>\n  </section>\n</div>",
  },
  Example {
    title: "Collapse a multi-line tag",
    note: "three lines into one, too dissimilar to refine so no inline marks",
    before: "<div>\n  <span\n    class=\"card\"\n  >x</span>\n</div>",
    after: "<div>\n  <span class=\"card\">x</span>\n</div>",
  },
  Example {
    title: "Two distant changes",
    note: "split into separate hunks, joined by the vertical ellipsis",
    before: "<div>\n  <span class='a'>one</span>\n  <p>filler</p>\n  <p>filler</p>\n  <p>filler</p>\n  <p>filler</p>\n  <span class='b'>two</span>\n</div>",
    after: "<div>\n  <span class=\"a\">one</span>\n  <p>filler</p>\n  <p>filler</p>\n  <p>filler</p>\n  <p>filler</p>\n  <span class=\"b\">two</span>\n</div>",
  },
  Example {
    title: "ERB block",
    note: "quoting and spacing inside an ERB expression",
    before: "<% @gems.each do |gem| %>\n  <%= render partial: 'gem_card', locals: {gem: gem} %>\n<% end %>",
    after: "<% @gems.each do |gem| %>\n  <%= render partial: \"gem_card\", locals: { gem: gem } %>\n<% end %>",
  },
];

const COLLAPSING: &[Example] = &[
  Example {
    title: "Pure insertion",
    note: "the composite is the real new line, nothing synthetic",
    before: "<div>\n  <img src=\"a.png\">\n  <p>untouched</p>\n</div>",
    after: "<div>\n  <img src=\"a.png\" alt=\"\">\n  <p>untouched</p>\n</div>",
  },
  Example {
    title: "Replacement",
    note: "the composite carries text that is in neither version, readable only by its tinting",
    before: "<div>\n  <span class='a'>one</span>\n  <p>untouched</p>\n</div>",
    after: "<div>\n  <span class=\"a\">one</span>\n  <p>untouched</p>\n</div>",
  },
  Example {
    title: "Two edits on one line",
    note: "declines to collapse, stays split",
    before: "<div>\n  <span class='a' id='b'>x</span>\n  <p>untouched</p>\n</div>",
    after: "<div>\n  <span class=\"a\" id=\"b\">x</span>\n  <p>untouched</p>\n</div>",
  },
  Example {
    title: "Long replacement",
    note: "inline collapses it, auto declines: too much text to read apart on one line",
    before: "<div>\n  <span class='alpha beta gamma delta'>one</span>\n  <p>untouched</p>\n</div>",
    after: "<div>\n  <span class=\"totally different set of names here\">one</span>\n  <p>untouched</p>\n</div>",
  },
  Example {
    title: "Multi-line restructure",
    note: "declines to collapse, no one-for-one pair exists",
    before: "<div>\n  <span>x</span>\n  <p>untouched</p>\n</div>",
    after: "<div>\n  <section>\n    <span>x</span>\n  </section>\n  <p>untouched</p>\n</div>",
  },
];

const SPLIT: &[Example] = &[
  Example {
    title: "Line-for-line replacement",
    note: "the two columns stay in step",
    before: "<div id=\"gems\">\n  <span class='a'>one</span>\n  <p>untouched</p>\n</div>",
    after: "<div id=\"gems\">\n  <span class=\"a\">one</span>\n  <p>untouched</p>\n</div>",
  },
  Example {
    title: "Restructure that adds lines",
    note: "the shorter side is left blank, and the numbering drifts apart below the change",
    before: "<div>\n  <SPAN>restructured</SPAN>\n  <p>untouched</p>\n</div>",
    after: "<div>\n  <section>\n    <span>restructured</span>\n  </section>\n  <p>untouched</p>\n</div>",
  },
];

fn heading(text: &str) -> String {
  format!("\x1b[1m{text}\x1b[0m")
}

fn subtle(text: &str) -> String {
  format!("\x1b[90m{text}\x1b[0m")
}

pub fn render_diff_examples(highlighter: &Highlighter) -> String {
  let mut output: Vec<String> = Vec::new();

  for Example { title, note, before, after } in EXAMPLES {
    output.push(format!("\n{} {}\n", heading(title), subtle(&format!("— {note}"))));

    output.push(highlighter.highlight_diff(
      "app/views/gems/index.html.erb",
      before,
      after,
      &DiffRenderOptions {
        context_lines: 1,
        wrap_lines: false,
        max_width: Some(120),
        ..Default::default()
      },
    ));
  }

  output.push(format!("\n\n{} {}", heading("Single-line collapsing"), subtle("(single_line_style)")));
  output.push(subtle(
    "  auto collapses a pair only when the composite reads better than two lines: always for a pure",
  ));
  output.push(subtle(
    "  insertion or deletion, and for a replacement only while the change stays short, stays a",
  ));
  output.push(subtle("  minority of the line, and still fits the width."));
  output.push(subtle(
    "  Needs color: without it every style falls back to split, since only the tinting tells old from new.\n",
  ));

  for Example { title, note, before, after } in COLLAPSING {
    output.push(format!("\n{} {}\n", heading(title), subtle(&format!("— {note}"))));

    for (label, style) in [
      ("split", SingleLineStyle::Split),
      ("inline", SingleLineStyle::Inline),
      ("auto", SingleLineStyle::Auto),
    ] {
      output.push(subtle(&format!("  {label}")));

      output.push(highlighter.highlight_diff(
        "",
        before,
        after,
        &DiffRenderOptions {
          context_lines: 1,
          wrap_lines: false,
          single_line_style: style,
          max_width: Some(120),
          indent: "  ".to_string(),
          ..Default::default()
        },
      ));

      output.push(String::new());
    }
  }

  output.push(format!(
    "\n{} {}",
    heading("Split layout"),
    subtle("(layout: Split, original on the left, modified on the right)")
  ));
  output.push(subtle(
    "  Each column is numbered from its own version of the file, so the two drift apart after a",
  ));
  output.push(subtle(
    "  change in line count. Falls back to the unified layout when the terminal is too narrow.\n",
  ));

  for Example { title, note, before, after } in SPLIT {
    output.push(format!("\n{} {}\n", heading(title), subtle(&format!("— {note}"))));

    output.push(highlighter.highlight_diff(
      "",
      before,
      after,
      &DiffRenderOptions {
        context_lines: 1,
        layout: DiffLayout::Split,
        max_width: Some(140),
        indent: "  ".to_string(),
        ..Default::default()
      },
    ));
  }

  output.push(format!(
    "\n{} {}\n",
    heading("Split layout, narrow terminal"),
    subtle("— 70 columns, falls back to unified")
  ));

  output.push(highlighter.highlight_diff(
    "",
    SPLIT[0].before,
    SPLIT[0].after,
    &DiffRenderOptions {
      context_lines: 1,
      layout: DiffLayout::Split,
      max_width: Some(70),
      indent: "  ".to_string(),
      ..Default::default()
    },
  ));

  output.join("\n")
}

fn main() {
  let highlighter = Highlighter::new("onedark").expect("onedark is bundled");

  println!("{}", render_diff_examples(&highlighter));
  println!();
}

#[cfg(test)]
mod tests {
  use super::render_diff_examples;

  use herb_highlighter::ansi::strip_ansi;
  use herb_highlighter::color::set_color_override;
  use herb_highlighter::highlighter::Highlighter;

  #[test]
  fn renders_every_example() {
    set_color_override(true);

    let highlighter = Highlighter::new("onedark").expect("onedark is bundled");

    insta::assert_snapshot!(strip_ansi(&render_diff_examples(&highlighter)));
  }
}
