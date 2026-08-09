use crate::document::{StyleRole, StyledRun};
use crate::themes::DEFAULT_THEME;

pub struct HTMLRenderOptions {
  pub focus_line: Option<usize>,
  pub context_lines: usize,
  pub show_line_numbers: bool,
  pub theme_label: String,
}

impl Default for HTMLRenderOptions {
  fn default() -> Self {
    Self {
      focus_line: None,
      context_lines: 2,
      show_line_numbers: true,
      theme_label: DEFAULT_THEME.as_str().to_string(),
    }
  }
}

pub fn escape_html(text: &str) -> String {
  text
    .replace('&', "&amp;")
    .replace('<', "&lt;")
    .replace('>', "&gt;")
    .replace('"', "&quot;")
    .replace('\'', "&#39;")
}

pub fn kebab(value: &str) -> String {
  value.to_lowercase().replace('_', "-")
}

pub fn class_for_role(role: &StyleRole) -> Option<String> {
  match role {
    StyleRole::Plain => None,
    StyleRole::Token(token_type) => Some(format!("herb-{}", kebab(token_type))),
    StyleRole::RubyKeyword => Some("herb-ruby-keyword".to_string()),
    StyleRole::TagName => Some("herb-tag-name".to_string()),
    StyleRole::AttributeName => Some("herb-attr-name".to_string()),
    StyleRole::AttributeValue => Some("herb-attr-value".to_string()),
    StyleRole::CommentInterior => Some("herb-comment".to_string()),
  }
}

fn split_lines(runs: &[StyledRun]) -> Vec<Vec<(&str, &StyleRole)>> {
  let mut lines: Vec<Vec<(&str, &StyleRole)>> = vec![Vec::new()];

  for run in runs {
    for (index, piece) in run.text.split('\n').enumerate() {
      if index > 0 {
        lines.push(Vec::new());
      }

      if !piece.is_empty() {
        lines.last_mut().expect("lines is never empty").push((piece, &run.role));
      }
    }
  }

  lines
}

fn line_content(line: &[(&str, &StyleRole)]) -> String {
  let mut content = String::new();

  for (text, role) in line {
    match class_for_role(role) {
      Some(class) => content.push_str(&format!("<span class=\"{class}\">{}</span>", escape_html(text))),
      None => content.push_str(&escape_html(text)),
    }
  }

  content
}

pub fn render_file_html(runs: &[StyledRun], path: &str, theme_label: &str) -> String {
  let line_spans: Vec<String> = split_lines(runs)
    .iter()
    .enumerate()
    .map(|(index, line)| format!("<span class=\"herb-line\" data-line=\"{}\">{}</span>", index + 1, line_content(line)))
    .collect();

  format!(
    "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n<figcaption class=\"herb-file-header\">{}</figcaption>\n<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
    escape_html(theme_label),
    escape_html(path),
    line_spans.join("\n")
  )
}

pub fn render_plain_html(runs: &[StyledRun], theme_label: &str) -> String {
  let line_spans: Vec<String> = split_lines(runs)
    .iter()
    .map(|line| format!("<span class=\"herb-line\">{}</span>", line_content(line)))
    .collect();

  format!(
    "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
    escape_html(theme_label),
    line_spans.join("\n")
  )
}

pub fn render_focus_html(runs: &[StyledRun], path: &str, focus_line: usize, context_lines: usize, show_line_numbers: bool, theme_label: &str) -> String {
  let lines = split_lines(runs);
  let start_line = 1.max(focus_line.saturating_sub(context_lines));
  let end_line = lines.len().min(focus_line + context_lines);

  let mut line_spans: Vec<String> = Vec::new();

  for number in start_line..=end_line {
    let line = &lines[number - 1];

    let class = if number == focus_line {
      "herb-line herb-line-focus"
    } else {
      "herb-line herb-line-dimmed"
    };

    if show_line_numbers {
      line_spans.push(format!("<span class=\"{class}\" data-line=\"{number}\">{}</span>", line_content(line)));
    } else {
      line_spans.push(format!("<span class=\"{class}\">{}</span>", line_content(line)));
    }
  }

  if show_line_numbers {
    format!(
      "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n<figcaption class=\"herb-file-header\">{}</figcaption>\n<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
      escape_html(theme_label),
      escape_html(path),
      line_spans.join("\n")
    )
  } else {
    format!(
      "<figure class=\"herb-highlight\" data-herb-theme=\"{}\">\n<pre class=\"herb-code\"><code>{}</code></pre>\n</figure>",
      escape_html(theme_label),
      line_spans.join("\n")
    )
  }
}
