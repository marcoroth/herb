mod common;

use herb_highlighter::highlighter::Highlighter;
use herb_highlighter::html_sink::HTMLRenderOptions;

const PATH: &str = "app/views/users/show.html.erb";

fn highlighter() -> Highlighter {
  Highlighter::new("onedark").expect("the theme resolves")
}

#[test]
fn renders_a_file_fragment_with_line_numbers() {
  let content = "<div>\n  <!-- first comment line\n  second comment line -->\n  <span>ok</span>\n</div>";

  insta::assert_snapshot!(highlighter().highlight_html(PATH, content, &HTMLRenderOptions::default()));
}

#[test]
fn escapes_html_metacharacters() {
  let content = "<div data-x=\"a&b\"><%= a < b && b > \"c\" %>'quoted'</div>";

  insta::assert_snapshot!(highlighter().highlight_html(PATH, content, &HTMLRenderOptions::default()));
}

#[test]
fn renders_a_plain_fragment_without_line_numbers() {
  let content = "<div>hello</div>\n<span>world</span>";

  let options = HTMLRenderOptions {
    show_line_numbers: false,
    ..Default::default()
  };

  insta::assert_snapshot!(highlighter().highlight_html(PATH, content, &options));
}

#[test]
fn renders_a_focus_fragment_with_dimmed_context() {
  let content = "<div>\n  <p>one</p>\n  <p>two</p>\n  <p>three</p>\n</div>";

  let options = HTMLRenderOptions {
    focus_line: Some(3),
    context_lines: 1,
    ..Default::default()
  };

  insta::assert_snapshot!(highlighter().highlight_html(PATH, content, &options));
}

#[test]
fn renders_an_empty_file_as_a_single_empty_line() {
  let result = highlighter().highlight_html(PATH, "", &HTMLRenderOptions::default());

  assert_eq!(
    result,
    "<figure class=\"herb-highlight\" data-herb-theme=\"onedark\">\n<figcaption class=\"herb-file-header\">app/views/users/show.html.erb</figcaption>\n<pre class=\"herb-code\"><code><span class=\"herb-line\" data-line=\"1\"></span></code></pre>\n</figure>"
  );
}

#[test]
fn focus_beyond_the_last_line_renders_an_empty_window() {
  let options = HTMLRenderOptions {
    focus_line: Some(10),
    context_lines: 1,
    ..Default::default()
  };

  let result = highlighter().highlight_html(PATH, "a\nb", &options);

  assert_eq!(
    result,
    "<figure class=\"herb-highlight\" data-herb-theme=\"onedark\">\n<figcaption class=\"herb-file-header\">app/views/users/show.html.erb</figcaption>\n<pre class=\"herb-code\"><code></code></pre>\n</figure>"
  );
}
