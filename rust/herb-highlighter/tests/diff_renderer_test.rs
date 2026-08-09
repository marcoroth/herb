mod common;

use herb_highlighter::ansi::find_ansi_sequences;
use herb_highlighter::diff_computer::compute_diff_hunks;
use herb_highlighter::diff_renderer::{DiffLayout, DiffRenderOptions, DiffRenderer, SingleLineStyle};
use herb_highlighter::syntax_renderer::SyntaxRenderer;
use herb_highlighter::themes::{get_theme, Theme};

use common::{no_color, strip_ansi_colors, with_color};

const ORIGINAL: &str = "<div id=\"gems\">\n  <span class='card'>\n    <%= render partial: \"gem_card\" %>\n  </span>\n  <img src=\"a.png\">\n</div>";

const MODIFIED: &str = "<div id=\"gems\">\n  <span class=\"card\">\n    <%= render partial: \"gem_card\" %>\n  </span>\n  <img src=\"a.png\" alt=\"\">\n</div>";

fn syntax_renderer() -> SyntaxRenderer {
  SyntaxRenderer::new(get_theme(Theme::OneDark).clone())
}

fn added_span() -> String {
  get_theme(Theme::OneDark)
    .diff_added_background
    .expect("onedark carries diff colors")
    .background()
    .into_owned()
}

fn removed_span() -> String {
  get_theme(Theme::OneDark)
    .diff_removed_background
    .expect("onedark carries diff colors")
    .background()
    .into_owned()
}

#[test]
fn renders_nothing_when_the_sources_are_identical() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  assert_eq!(renderer.render("/test/file.erb", ORIGINAL, ORIGINAL, &DiffRenderOptions::default()), "");
}

#[test]
fn renders_removals_and_additions_in_the_gutter_alongside_line_numbers() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "/test/file.erb",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn keeps_context_numbering_monotonic_when_the_fix_changes_the_line_count() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let shorter = "<div>\n  <span>one</span>\n</div>";
  let longer = "<div>\n  <span>one</span>\n  <span>two</span>\n</div>";

  let result = renderer.render(
    "/test/file.erb",
    shorter,
    longer,
    &DiffRenderOptions {
      wrap_lines: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn separates_distant_hunks_with_a_marker() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = ["<div>", "<a>", "<b>", "<c>", "<d>", "<e>", "<f>"].join("\n");
  let after = ["<div>", "<a2>", "<b>", "<c>", "<d>", "<e2>", "<f>"].join("\n");

  let result = renderer.render(
    "/test/file.erb",
    &before,
    &after,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      ..Default::default()
    },
  );

  assert!(strip_ansi_colors(&result).contains('⋮'));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn omits_the_header_and_gutter_when_line_numbers_are_hidden() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "/test/file.erb",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      show_line_numbers: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn indents_the_whole_diff_for_nesting_under_an_offense() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 0,
      indent: "      ".to_string(),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn truncates_long_lines_when_asked() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = format!("<div class=\"{}\">old</div>", "a".repeat(200));
  let after = format!("<div class=\"{}\">new</div>", "a".repeat(200));

  let result = renderer.render(
    "/test/file.erb",
    &before,
    &after,
    &DiffRenderOptions {
      truncate_lines: true,
      max_width: Some(60),
      ..Default::default()
    },
  );

  assert!(strip_ansi_colors(&result).contains('…'));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn backgrounds_only_the_characters_that_changed_keeping_syntax_colors() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "/test/file.erb",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 0,
      ..Default::default()
    },
  );

  assert!(!find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}

#[test]
fn leaves_lines_unmarked_when_a_block_was_restructured_rather_than_rewritten_in_place() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = "<div>\n  <span>content</span>\n</div>";
  let after = "<div>\n  <section>\n    <span>content</span>\n  </section>\n</div>";

  let result = renderer.render(
    "/test/file.erb",
    before,
    after,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 0,
      ..Default::default()
    },
  );

  assert!(!result.contains(&removed_span()));
  assert!(!result.contains(&added_span()));
}

#[test]
fn marks_the_inserted_indentation_when_a_block_is_reindented_line_for_line() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = ["<div>", "<span>one</span>", "<span>two</span>", "</div>"].join("\n");
  let after = ["<div>", "  <span>one</span>", "  <span>two</span>", "</div>"].join("\n");

  let result = renderer.render(
    "/test/file.erb",
    &before,
    &after,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 0,
      ..Default::default()
    },
  );

  assert!(result.contains(&added_span()));

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn inline_change_highlighting_can_be_turned_off() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "/test/file.erb",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 0,
      highlight_inline_changes: false,
      ..Default::default()
    },
  );

  assert!(!result.contains(&removed_span()));
  assert!(!result.contains(&added_span()));
}

#[test]
fn puts_the_original_on_the_left_and_the_modified_on_the_right() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      layout: DiffLayout::Split,
      context_lines: 1,
      max_width: Some(140),
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn numbers_each_column_from_its_own_version_of_the_file() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = ["<div>", "  <span>x</span>", "</div>"].join("\n");
  let after = ["<div>", "  <section>", "    <span>x</span>", "  </section>", "</div>"].join("\n");

  let result = strip_ansi_colors(&renderer.render(
    "",
    &before,
    &after,
    &DiffRenderOptions {
      layout: DiffLayout::Split,
      context_lines: 1,
      max_width: Some(140),
      ..Default::default()
    },
  ));

  let last_row = result.split('\n').next_back().expect("the diff has rows").to_string();
  let mut columns = last_row.split('┃');

  assert!(columns.next().expect("a left column").contains("3 │ </div>"));
  assert!(columns.next().expect("a right column").contains("5 │ </div>"));
}

#[test]
fn leaves_the_shorter_side_blank_when_the_two_runs_differ_in_length() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = ["<div>", "  <span>x</span>", "</div>"].join("\n");
  let after = ["<div>", "  <section>", "    <span>x</span>", "  </section>", "</div>"].join("\n");

  let result = strip_ansi_colors(&renderer.render(
    "",
    &before,
    &after,
    &DiffRenderOptions {
      layout: DiffLayout::Split,
      context_lines: 0,
      max_width: Some(140),
      ..Default::default()
    },
  ));

  insta::assert_snapshot!(result);
}

#[test]
fn falls_back_to_the_unified_layout_when_the_columns_would_be_too_narrow() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = strip_ansi_colors(&renderer.render(
    "",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      layout: DiffLayout::Split,
      context_lines: 1,
      max_width: Some(70),
      ..Default::default()
    },
  ));

  assert!(!result.contains('┃'));
  assert!(result.contains("-   2"));
}

const ISOLATED_BEFORE: &str = "<div>\n  <span class='a'>one</span>\n  <p>untouched</p>\n</div>";
const ISOLATED_AFTER: &str = "<div>\n  <span class=\"a\">one</span>\n  <p>untouched</p>\n</div>";

#[test]
fn collapses_an_isolated_one_for_one_replacement_onto_a_single_line() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "",
    ISOLATED_BEFORE,
    ISOLATED_AFTER,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      single_line_style: SingleLineStyle::Inline,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn splits_the_same_change_by_default() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = strip_ansi_colors(&renderer.render(
    "",
    ISOLATED_BEFORE,
    ISOLATED_AFTER,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      ..Default::default()
    },
  ));

  assert!(result.contains("-   2"));
  assert!(result.contains('+'));
}

#[test]
fn declines_to_collapse_when_a_line_has_two_separate_edits() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = ["<div>", "  <span class='a' id='b'>x</span>", "</div>"].join("\n");
  let after = ["<div>", "  <span class=\"a\" id=\"b\">x</span>", "</div>"].join("\n");

  let result = strip_ansi_colors(&renderer.render(
    "",
    &before,
    &after,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      single_line_style: SingleLineStyle::Inline,
      ..Default::default()
    },
  ));

  assert!(!result.contains('±'));
}

#[test]
fn declines_to_collapse_a_multi_line_restructure() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let before = ["<div>", "  <span>x</span>", "</div>"].join("\n");
  let after = ["<div>", "  <section>", "    <span>x</span>", "  </section>", "</div>"].join("\n");

  let result = strip_ansi_colors(&renderer.render(
    "",
    &before,
    &after,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      single_line_style: SingleLineStyle::Inline,
      ..Default::default()
    },
  ));

  assert!(!result.contains('±'));
}

#[test]
fn falls_back_to_splitting_when_color_is_off() {
  no_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "",
    ISOLATED_BEFORE,
    ISOLATED_AFTER,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      single_line_style: SingleLineStyle::Inline,
      ..Default::default()
    },
  );

  assert!(!result.contains('±'));
  assert!(find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}

fn collapses(before: &str, after: &str, max_width: usize) -> bool {
  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let wrap = |line: &str| ["<div>", line, "</div>"].join("\n");

  renderer
    .render(
      "",
      &wrap(before),
      &wrap(after),
      &DiffRenderOptions {
        context_lines: 0,
        wrap_lines: false,
        single_line_style: SingleLineStyle::Auto,
        max_width: Some(max_width),
        ..Default::default()
      },
    )
    .contains('±')
}

#[test]
fn auto_collapses_a_pure_insertion() {
  with_color();

  assert!(collapses("  <img src=\"a.png\">", "  <img src=\"a.png\" alt=\"\">", 120));
}

#[test]
fn auto_collapses_a_pure_deletion() {
  with_color();

  assert!(collapses("  <img src=\"a.png\" onclick=\"x()\">", "  <img src=\"a.png\">", 120));
}

#[test]
fn auto_collapses_a_small_replacement() {
  with_color();

  assert!(collapses("  <span class='a'>one</span>", "  <span class=\"a\">one</span>", 120));
}

#[test]
fn auto_keeps_a_long_replacement_split() {
  with_color();

  assert!(!collapses(
    "  <span class='alpha beta gamma delta'>one</span>",
    "  <span class=\"totally different set of names here\">one</span>",
    120
  ));
}

#[test]
fn auto_keeps_a_replacement_covering_most_of_the_line_split() {
  with_color();

  assert!(!collapses("  <a href='/old'>Old</a>", "  <button data-x='y'>New</button>", 120));
}

#[test]
fn auto_keeps_a_change_split_when_the_composite_would_not_fit_the_width() {
  with_color();

  let before = format!("  <span class='a'>{}</span>", "x".repeat(50));
  let after = format!("  <span class=\"a\">{}</span>", "x".repeat(50));

  assert!(collapses(&before, &after, 120));
  assert!(!collapses(&before, &after, 80));
}

#[test]
fn auto_collapses_nothing_when_color_is_off() {
  no_color();

  assert!(!collapses("  <img src=\"a.png\">", "  <img src=\"a.png\" alt=\"\">", 120));
}

const DIFF_BEFORE: &str = "<div id=\"gems\">\n  <span class='card'>x</span>\n  <p>keep</p>\n</div>";
const DIFF_AFTER: &str = "<div id=\"gems\">\n  <span class=\"card\">x</span>\n  <p>keep</p>\n</div>";

#[test]
fn renders_with_the_simple_theme() {
  with_color();

  let syntax_renderer = SyntaxRenderer::new(get_theme(Theme::Simple).clone());
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::Simple).clone());

  let result = renderer.render(
    "/test/file.erb",
    DIFF_BEFORE,
    DIFF_AFTER,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(result);
}

#[test]
fn collapses_inline_without_diff_backgrounds() {
  with_color();

  let syntax_renderer = SyntaxRenderer::new(get_theme(Theme::Simple).clone());
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::Simple).clone());

  let result = renderer.render(
    "",
    DIFF_BEFORE,
    DIFF_AFTER,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      single_line_style: SingleLineStyle::Inline,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(result);
}

#[test]
fn renders_hunks_that_arrived_without_their_sources() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let hunks = compute_diff_hunks(ORIGINAL, MODIFIED, 1);

  let result = renderer.render_from_hunks(
    "/test/file.erb",
    &hunks,
    &DiffRenderOptions {
      wrap_lines: false,
      ..Default::default()
    },
  );

  insta::assert_snapshot!(strip_ansi_colors(&result));
}

#[test]
fn matches_what_rendering_from_the_sources_produces() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let hunks = compute_diff_hunks(ORIGINAL, MODIFIED, 1);

  let options = DiffRenderOptions {
    wrap_lines: false,
    context_lines: 1,
    ..Default::default()
  };

  let from_hunks = renderer.render_from_hunks("/test/file.erb", &hunks, &options);
  let from_sources = renderer.render("/test/file.erb", ORIGINAL, MODIFIED, &options);

  assert_eq!(strip_ansi_colors(&from_hunks), strip_ansi_colors(&from_sources));
}

#[test]
fn renders_nothing_when_given_no_hunks() {
  with_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  assert_eq!(renderer.render_from_hunks("/test/file.erb", &[], &DiffRenderOptions::default()), "");
}

#[test]
fn renders_the_diff_without_any_escape_codes_when_color_is_off() {
  no_color();

  let syntax_renderer = syntax_renderer();
  let renderer = DiffRenderer::new(&syntax_renderer, get_theme(Theme::OneDark).clone());

  let result = renderer.render(
    "/test/file.erb",
    ORIGINAL,
    MODIFIED,
    &DiffRenderOptions {
      wrap_lines: false,
      context_lines: 1,
      ..Default::default()
    },
  );

  assert!(find_ansi_sequences(&result).is_empty());

  insta::assert_snapshot!(result);
}
