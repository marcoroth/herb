# Herb Highlighter

**Crate:** `herb-highlighter`

---

Syntax highlighter, code snippet renderer, and diagnostic renderer for HTML+ERB templates with terminal color support.

This is the Rust counterpart of the [`@herb-tools/highlighter`](https://www.npmjs.com/package/@herb-tools/highlighter) package and renders the same output.

## CLI Usage

Highlight a file:

```bash
herb-highlight app/views/users/show.html.erb
```

Highlight a file with a theme:

```bash
herb-highlight app/views/users/show.html.erb --theme=tokyo-night
```

Highlight a file with a custom theme:

```bash
herb-highlight app/views/users/show.html.erb --theme=path/to/theme.json
```

Focus on line 10:

```bash
herb-highlight app/views/users/show.html.erb --focus=10
```

Focus on line 10 and show 3 lines before and after:

```bash
herb-highlight app/views/users/show.html.erb --focus=10 --context-lines=3
```

Diff two files:

```bash
herb-highlight diff before.html.erb after.html.erb
```

Render a `git diff`, piped in on stdin:

```bash
git diff -- app/views | herb-highlight diff
```

Render a diff, passed as a JSON string:

```bash
herb-highlight diff '{"original": "<img src=\"a.png\">", "modified": "<img src=\"a.png\" alt=\"\">"}'
```

Render a diff from a file:

```bash
herb-highlight diff fix.json
```

The binary is behind the `cli` feature:

```bash
cargo build -p herb-highlighter --features herb-highlighter/cli
```

## Usage

```rust
use herb_highlighter::{HighlightOptions, Highlighter};

let mut highlighter = Highlighter::new("onedark").unwrap();

highlighter.initialize();

highlighter.highlight(
  "filename.html.erb",
  "<% if true %><span>true</span><% end %>",
  &HighlightOptions::default(),
);
```

## Rendering a Diff

`highlight_diff` renders the change between two sources as a syntax-highlighted diff, with the characters that actually changed picked out within each line.

```rust
highlighter.highlight_diff(
  "filename.html.erb",
  "<span class='card'>",
  "<span class=\"card\">",
  &DiffRenderOptions::default(),
);
```

```
filename.html.erb

  -   1 │ <span class='card'>
  +     │ <span class="card">
```

The line number column refers to the original source throughout, so it stays monotonic even when a fix changes the line count. Added lines have no counterpart there and are left blank.

## Rendering a Diff That Came From Elsewhere

`highlight_diff_hunks` renders hunks that arrived without their sources, and the CLI exposes the same thing through `herb-highlight diff`, which takes two files, a JSON string, a file path, or stdin. It accepts unified diff text as produced by `git diff`, along with `{"original": "...", "modified": "..."}` and `{"hunks": [...]}`:

```bash
git diff -- app/views | herb-highlight --diff
```

## Configuration Options

`highlight()` takes a [`HighlightOptions`]:

```rust
pub struct HighlightOptions<'a> {
  pub diagnostics: &'a [Diagnostic],
  pub split_diagnostics: bool,
  pub context_lines: usize,
  pub focus_line: Option<usize>,
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
  pub code_url_builder: Option<&'a dyn Fn(&str) -> String>,
  pub file_url_builder: Option<&'a dyn Fn(&str, &Diagnostic) -> String>,
  pub suffix_builder: Option<&'a dyn Fn(&Diagnostic) -> Option<String>>,
}
```

`highlight_diff()` and `highlight_diff_hunks()` take a [`DiffRenderOptions`]:

```rust
pub struct DiffRenderOptions {
  pub context_lines: usize,
  pub show_line_numbers: bool,
  pub wrap_lines: bool,
  pub max_width: Option<usize>,
  pub truncate_lines: bool,
  pub highlight_inline_changes: bool,
  pub removed_line_style: RemovedLineStyle,
  pub single_line_style: SingleLineStyle,
  pub layout: DiffLayout,
  pub indent: String,
}
```

`removed_line_style` controls how the removed side is set apart: `Tint` washes it in the theme's removed background, `Dim` fades it the way context lines are faded, `None` leaves it to the `-` marker alone.

`single_line_style` controls whether a one-for-one line replacement is stacked or collapsed onto a single `±` line. `Auto` collapses only where that reads better: a pure insertion or deletion, whose composite is a real line from one of the two versions, and a replacement only while the change stays short, stays a minority of the line, and still fits the width.

`layout` chooses between stacking the two sides and putting the original in a left column with the modified in a right one. Split falls back to unified when the terminal is too narrow to give each column readable width.

Collapsing and tinting both need color. With `NO_COLOR` set nothing collapses and nothing is tinted, whatever `single_line_style` says. A collapsed replacement would read as text belonging to neither version, and even a collapsed insertion would show the resulting line without showing which part was added, so the stacked pair carries more.

## Examples

```bash
cargo run -p herb-highlighter --example diff_view
cargo run -p herb-highlighter --example diff_styles
```

## Testing

```bash
cargo test -p herb-highlighter
```
