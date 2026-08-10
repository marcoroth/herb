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

Render a file as an HTML fragment:

```bash
herb-highlight app/views/users/show.html.erb --format html
```

Print the document IR as JSON:

```bash
herb-highlight app/views/users/show.html.erb --format json
```

Print the stylesheet the HTML output expects:

```bash
herb-highlight --emit-css onedark
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

## Output Formats

`--format` selects `ansi`, `html`, or `json` and defaults to `ansi`. All three render the same document, so the terminal view and the browser view stay in step. The `diff` subcommand takes the same flag, so a diff can be rendered as HTML with tinted rows and inline change marks, or emitted as JSON. Every format is byte for byte identical to the output of the `@herb-tools/highlighter` CLI.

### HTML

`--format html` renders a self-describing fragment:

```html
<figure class="herb-highlight" data-herb-theme="onedark">
<figcaption class="herb-file-header">show.html.erb</figcaption>
<pre class="herb-code"><code><span class="herb-line" data-line="1"><span class="herb-token-html-tag-start">&lt;</span><span class="herb-tag-name">div</span><span class="herb-token-html-tag-end">&gt;</span></span>
<span class="herb-line" data-line="2"><span class="herb-token-whitespace">  </span><span class="herb-token-erb-start">&lt;%</span> <span class="herb-ruby-keyword">if</span> user <span class="herb-token-erb-end">%&gt;</span></span>
</code></pre>
</figure>
```

Each line is a `span` carrying its line number in `data-line`, and the stylesheet draws the number from that attribute with a `::before` rule. The gutter is never text content, so selecting the snippet and copying it yields the code alone.

### JSON

`--format json` prints the document IR that the ANSI and HTML renderers both consume:

```json
{
  "version": 1,
  "nodes": [
    { "type": "FileHeader", "path": "show.html.erb", "line": null, "column": null, "url": null },
    { "type": "CodeBlock", "kind": "Listing", "firstLine": 1, "runs": ["..."], "lines": ["..."] }
  ]
}
```

The document is versioned, and it carries no colors, no theme, and no assumptions about a terminal. It can be stored, shipped across a process boundary, and rendered later by a consumer that knows nothing about how it was produced.

## Stylesheets

The HTML output carries class names and CSS custom properties only, so all styling comes from a stylesheet. `--emit-css` prints the one matching a theme:

```bash
herb-highlight --emit-css onedark > herb.css
```

A `dark:light` pair emits a dark base, a light block behind `prefers-color-scheme: light`, and explicit `data-herb-appearance` overrides:

```bash
herb-highlight --emit-css onedark:github-light > herb.css
```

The attribute overrides come after the media query and therefore win, so a site with its own theme toggle can pin any fragment to one appearance by setting `data-herb-appearance` on it, while fragments without the attribute keep following the OS setting.

## Diagnostics in HTML

`--diagnostics` and `--split-diagnostics` work under `--format html` too, and four flags shape the markup they produce.

`--html-markers` selects the marker strategy and defaults to `spans`, which wraps each marked token in a `<mark>`. `highlight-api` keeps the token spans pristine, stores the marked ranges on the line in a `data-herb-markers` attribute, and relies on a hydration script that paints the ranges through the CSS Custom Highlight API with per-severity priorities.

`--html-messages` selects how annotation messages appear and defaults to `inline`, which renders each message as a visible annotation under the marked tokens. `hover` turns the messages into pure-CSS tooltips revealed while the marked line is hovered or holds focus.

`--html-chrome` selects between `fragment`, the default, and `document`, which wraps the output in a standalone HTML page with the stylesheet embedded, plus the hydration script when `--html-markers highlight-api` is active.

`--html-fragment-separator` prints a separator line between the fragments of `--split-diagnostics` output, so a consuming process can split the stream into one fragment per diagnostic. A separator that starts with `-` would be read as a flag, so it needs the `=` spelling, as in `--html-fragment-separator=----fragment----`.

## Library API

The CLI is a thin layer over the exported rendering pipeline, which can be driven directly.

`highlight_runs` lexes content into styled runs, the atoms every renderer consumes:

```rust
use herb_highlighter::{resolve_theme, SyntaxRenderer};

let renderer = SyntaxRenderer::new(resolve_theme("onedark").unwrap());

let runs = renderer.highlight_runs("<span>");
```

`build_document` assembles the document IR that `highlight()` renders, dispatched on the same options:

```rust
let document = highlighter.build_document("show.html.erb", content, &HighlightOptions::default());
```

`render_document_html` renders a document as an HTML fragment:

```rust
use herb_highlighter::{render_document_html, HTMLSinkOptions};

let html = render_document_html(&document, &HTMLSinkOptions::default());
```

`generate_stylesheet` prints the stylesheet those fragments expect, with an optional light counterpart for a `dark:light` pair:

```rust
use herb_highlighter::{generate_stylesheet, resolve_theme};

let dark = resolve_theme("onedark").unwrap();
let light = resolve_theme("github-light").unwrap();

generate_stylesheet(&dark, "onedark", None);
generate_stylesheet(&dark, "onedark:github-light", Some((&light, "github-light")));
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
