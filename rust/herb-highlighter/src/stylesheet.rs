use crate::color::{Color, NamedColor};
use crate::html_sink::kebab;
use crate::themes::{ColorScheme, OPTIONAL_COLOR_SCHEME_KEYS, REQUIRED_COLOR_SCHEME_KEYS};

const DIAGNOSTIC_RULES: &str = r#".herb-highlight .herb-severity-label { font-weight: bold; }
.herb-highlight .herb-severity-label.herb-severity-error { color: var(--herb-severity-error, #F14C4C); }
.herb-highlight .herb-severity-label.herb-severity-warning { color: var(--herb-severity-warning, #F5F543); }
.herb-highlight .herb-severity-label.herb-severity-info { color: var(--herb-severity-info, #11A8CD); }
.herb-highlight .herb-severity-label.herb-severity-hint { color: var(--herb-severity-hint, #666666); }

.herb-highlight .herb-diagnostic-header {
  display: block;
  margin: 0 0 0.75em;
}

.herb-highlight .herb-diagnostic-message code {
  padding: 0 0.25em;
  border-radius: 3px;
  background-color: var(--herb-inline-code-bg, rgba(127, 127, 127, 0.18));
}

.herb-highlight .herb-diagnostic-code {
  opacity: 0.7;
}

.herb-highlight .herb-diagnostic-suffix {
  opacity: 0.7;
}

.herb-highlight .herb-annotation-message {
  display: block;
  user-select: none;
  opacity: 0.85;
}

.herb-highlight .herb-line-marked[data-line]::before {
  font-weight: bold;
}

.herb-highlight a {
  color: inherit;
}

.herb-highlight mark.herb-marker {
  color: inherit;
  background-color: transparent;
  text-decoration: underline wavy;
  text-decoration-skip-ink: none;
}

.herb-highlight mark.herb-marker-error { background-color: var(--herb-marker-error-bg, rgba(241, 76, 76, 0.15)); text-decoration-color: var(--herb-severity-error, #F14C4C); }
.herb-highlight mark.herb-marker-warning { background-color: var(--herb-marker-warning-bg, rgba(245, 245, 67, 0.15)); text-decoration-color: var(--herb-severity-warning, #F5F543); }
.herb-highlight mark.herb-marker-info { background-color: var(--herb-marker-info-bg, rgba(17, 168, 205, 0.15)); text-decoration-color: var(--herb-severity-info, #11A8CD); }
.herb-highlight mark.herb-marker-hint { background-color: var(--herb-marker-hint-bg, rgba(102, 102, 102, 0.15)); text-decoration-color: var(--herb-severity-hint, #666666); }

::highlight(herb-marker-error) { background-color: var(--herb-marker-error-bg, rgba(241, 76, 76, 0.15)); text-decoration: underline wavy var(--herb-severity-error, #F14C4C); }
::highlight(herb-marker-warning) { background-color: var(--herb-marker-warning-bg, rgba(245, 245, 67, 0.15)); text-decoration: underline wavy var(--herb-severity-warning, #F5F543); }
::highlight(herb-marker-info) { background-color: var(--herb-marker-info-bg, rgba(17, 168, 205, 0.15)); text-decoration: underline wavy var(--herb-severity-info, #11A8CD); }
::highlight(herb-marker-hint) { background-color: var(--herb-marker-hint-bg, rgba(102, 102, 102, 0.15)); text-decoration: underline wavy var(--herb-severity-hint, #666666); }

.herb-progress-rule {
  position: relative;
  margin: 1.5em 0;
  border: none;
  border-top: 1px solid var(--herb-rule, rgba(127, 127, 127, 0.4));
}

.herb-progress-rule::after {
  content: attr(data-herb-progress);
  position: absolute;
  top: -0.75em;
  right: 1em;
  padding: 0 0.5em;
  font-size: 0.8em;
  color: var(--herb-rule-label, #666666);
  background-color: var(--herb-rule-label-bg, Canvas);
}"#;

const DIFF_RULES: &str = r#".herb-highlight .herb-line[data-old-line]::before,
.herb-highlight .herb-line[data-new-line]::before {
  display: inline-block;
  width: 3ch;
  margin-right: 1ch;
  text-align: right;
  color: var(--herb-line-number, #666666);
  user-select: none;
}

.herb-highlight .herb-diff-context[data-old-line]::before { content: attr(data-old-line); }
.herb-highlight .herb-diff-removed[data-old-line]::before { content: attr(data-old-line); color: var(--herb-severity-error, #F14C4C); }
.herb-highlight .herb-diff-added[data-new-line]::before { content: attr(data-new-line); color: var(--herb-diff-added-number, #0DBC79); }

.herb-highlight .herb-diff-context {
  opacity: 0.75;
}

.herb-highlight .herb-diff-added {
  background-color: var(--herb-diff-added-line-background, rgba(13, 188, 121, 0.12));
}

.herb-highlight .herb-diff-removed {
  background-color: var(--herb-diff-removed-line-background, rgba(241, 76, 76, 0.12));
}

.herb-highlight mark.herb-diff-inline-added {
  color: inherit;
  background-color: var(--herb-diff-added-background, rgba(13, 188, 121, 0.35));
}

.herb-highlight mark.herb-diff-inline-removed {
  color: inherit;
  background-color: var(--herb-diff-removed-background, rgba(241, 76, 76, 0.35));
}

.herb-highlight .herb-diff-hunk-separator::before {
  content: "⋮";
  display: inline-block;
  width: 3ch;
  margin-right: 1ch;
  text-align: right;
  color: var(--herb-line-number, #666666);
  user-select: none;
}

.herb-highlight .herb-diff-columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 1.5em;
}

.herb-highlight .herb-diff-column {
  margin: 0;
  white-space: pre;
  overflow-x: auto;
}

.herb-highlight .herb-diff-column-new {
  border-left: 1px solid var(--herb-rule, rgba(127, 127, 127, 0.4));
  padding-left: 1.5em;
}

.herb-highlight .herb-diff-empty {
  display: block;
}"#;

const HOVER_MESSAGE_RULES: &str = r#".herb-highlight.herb-messages-hover .herb-line-marked {
  position: relative;
}

.herb-highlight.herb-messages-hover .herb-annotation-message {
  display: none;
  position: absolute;
  left: 5ch;
  top: 100%;
  z-index: 1;
  width: max-content;
  max-width: 60ch;
  padding: 0.5em 0.75em;
  border: 1px solid var(--herb-rule, rgba(127, 127, 127, 0.4));
  border-radius: 6px;
  background-color: var(--herb-tooltip-bg, Canvas);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  white-space: normal;
}

.herb-highlight.herb-messages-hover .herb-line-marked:hover .herb-annotation-message,
.herb-highlight.herb-messages-hover .herb-line-marked:focus-within .herb-annotation-message {
  display: block;
}"#;

fn named_css(named: NamedColor) -> &'static str {
  match named {
    NamedColor::Reset | NamedColor::Bold | NamedColor::Dim => "inherit",
    NamedColor::Black | NamedColor::BgBlack => "#000000",
    NamedColor::Red | NamedColor::BgRed => "#CD3131",
    NamedColor::Green | NamedColor::BgGreen => "#0DBC79",
    NamedColor::Yellow | NamedColor::BgYellow => "#E5E510",
    NamedColor::Blue | NamedColor::BgBlue => "#2472C8",
    NamedColor::Magenta | NamedColor::BgMagenta => "#BC3FBC",
    NamedColor::Cyan | NamedColor::BgCyan => "#11A8CD",
    NamedColor::White | NamedColor::BgWhite => "#E5E5E5",
    NamedColor::Gray | NamedColor::BgGray => "#666666",
    NamedColor::BrightRed => "#F14C4C",
    NamedColor::BrightGreen => "#23D18B",
    NamedColor::BrightYellow => "#F5F543",
    NamedColor::BrightBlue => "#3B8EEA",
    NamedColor::BrightMagenta => "#D670D6",
    NamedColor::BrightCyan => "#29B8DB",
  }
}

fn css_color(color: Color) -> String {
  match color {
    Color::Rgb(red, green, blue) => format!("#{red:02X}{green:02X}{blue:02X}"),
    Color::Named(named) => named_css(named).to_string(),
  }
}

fn color_for_key(scheme: &ColorScheme, key: &str) -> Option<Color> {
  match key {
    "RUBY_KEYWORD" => Some(scheme.ruby_keyword),
    "DIFF_REMOVED_LINE_BACKGROUND" => scheme.diff_removed_line_background,
    "DIFF_ADDED_LINE_BACKGROUND" => scheme.diff_added_line_background,
    "DIFF_REMOVED_BACKGROUND" => scheme.diff_removed_background,
    "DIFF_ADDED_BACKGROUND" => scheme.diff_added_background,
    _ => scheme.for_token_type(key),
  }
}

fn properties(scheme: &ColorScheme, indent: &str) -> String {
  let mut lines: Vec<String> = Vec::new();

  for key in REQUIRED_COLOR_SCHEME_KEYS.iter().chain(OPTIONAL_COLOR_SCHEME_KEYS) {
    if let Some(color) = color_for_key(scheme, key) {
      lines.push(format!("{indent}--herb-{}: {};", kebab(key), css_color(color)));
    }
  }

  lines.push(format!("{indent}--herb-attr-name: #D19A66;"));
  lines.push(format!("{indent}--herb-attr-value: #98C379;"));

  lines.join("\n")
}

pub fn generate_stylesheet(dark: &ColorScheme, label: &str, light: Option<(&ColorScheme, &str)>) -> String {
  let token_rules: Vec<String> = REQUIRED_COLOR_SCHEME_KEYS
    .iter()
    .map(|key| {
      let name = kebab(key);

      format!(".herb-highlight .herb-{name} {{ color: var(--herb-{name}); }}")
    })
    .collect();

  let mut sections: Vec<String> = vec![
    format!("/* herb-highlight theme: {label} */"),
    ".herb-highlight {\n  margin: 0;\n}".to_string(),
    ".herb-highlight .herb-file-header {\n  color: var(--herb-file-header, #11A8CD);\n}".to_string(),
    ".herb-highlight .herb-code {\n  margin: 0;\n  white-space: pre-wrap;\n  overflow-wrap: anywhere;\n}".to_string(),
    ".herb-highlight .herb-line[data-line]::before {\n  content: attr(data-line);\n  display: inline-block;\n  width: 3ch;\n  margin-right: 1ch;\n  text-align: right;\n  color: var(--herb-line-number, #666666);\n  user-select: none;\n}".to_string(),
    ".herb-highlight .herb-line-dimmed {\n  opacity: 0.6;\n}".to_string(),
    ".herb-highlight .herb-line-focus[data-line]::before {\n  color: var(--herb-line-number-focus, #11A8CD);\n  font-weight: bold;\n}".to_string(),
    token_rules.join("\n"),
    [
      ".herb-highlight .herb-tag-name { color: var(--herb-token-html-tag-start); }",
      ".herb-highlight .herb-attr-name { color: var(--herb-attr-name); }",
      ".herb-highlight .herb-attr-value { color: var(--herb-attr-value); }",
      ".herb-highlight .herb-comment { color: var(--herb-token-html-comment-start); }",
    ]
    .join("\n"),
    DIAGNOSTIC_RULES.to_string(),
    DIFF_RULES.to_string(),
    HOVER_MESSAGE_RULES.to_string(),
    format!(".herb-highlight {{\n{}\n}}", properties(dark, "  ")),
  ];

  if let Some((light_scheme, _)) = light {
    sections.push(format!(
      "@media (prefers-color-scheme: light) {{\n  .herb-highlight {{\n{}\n  }}\n}}",
      properties(light_scheme, "    ")
    ));

    sections.push(format!(".herb-highlight[data-herb-appearance=\"dark\"] {{\n{}\n}}", properties(dark, "  ")));

    sections.push(format!(
      ".herb-highlight[data-herb-appearance=\"light\"] {{\n{}\n}}",
      properties(light_scheme, "  ")
    ));
  }

  format!("{}\n", sections.join("\n\n"))
}
