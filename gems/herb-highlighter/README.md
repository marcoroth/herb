## Herb Highlighter

**Gem:** `herb-highlighter`

---

Syntax highlighter, code snippet renderer, and diagnostic renderer for HTML+ERB templates with terminal color support.

This is the Ruby counterpart of the [`herb-highlighter`](../../rust/herb-highlighter) Rust crate and the [`@herb-tools/highlighter`](https://www.npmjs.com/package/@herb-tools/highlighter) package, and renders the same output. The gem is a thin Ruby layer over a C extension that links the Rust crate, so nothing is reimplemented here.

### Installation

```bash
gem install herb-highlighter
```

Precompiled binaries ship for Linux and macOS. On any other platform the gem builds its Rust crate at install time, which needs the [Rust toolchain](https://rustup.rs) and network access to fetch the crates from [crates.io](https://crates.io).

### Usage

```ruby
require "herb-highlighter"

highlighter = Herb::Highlighter.new

puts highlighter.highlight_file("app/views/users/show.html.erb")
```

For one-off rendering there are class-level shortcuts that build a highlighter for you:

```ruby
Herb::Highlighter.highlight(content, path: "show.html.erb")
Herb::Highlighter.highlight_file("app/views/users/show.html.erb", theme: "dracula")
```

### Rendering Diagnostics

Pass `diagnostics:` to mark ranges inline, underneath the lines they cover:

```ruby
highlighter.highlight(content, path: "show.html.erb", diagnostics: [
  {
    message: "Image is missing an alt attribute",
    code: "html-img-require-alt",
    severity: :error,
    location: { start: { line: 2, column: 2 }, end: { line: 2, column: 22 } }
  }
])
```

```
show.html.erb

    1 │ <% if user.admin? %>
  → 2 │   <img src="badge.png">
      │   ~~~~~~~~~~~~~~~~~~~~
      │ [error] Image is missing an alt attribute (html-img-require-alt)
      │
    3 │ <% end %>
```

A diagnostic is a Hash with symbol or string keys. `message`, `location` and `severity` are required; `code`, `source` and `tags` are optional. Keys the renderer does not know are ignored, so a `Herb::Diagnostic` from the `herb` gem passes through as-is with its extra fields.

`split_diagnostics: true` renders one snippet per diagnostic instead of marking them all on one listing. `highlight_diagnostic` renders a single one on its own, with a header naming the file and position:

```ruby
highlighter.highlight_diagnostic(content, diagnostic, path: "show.html.erb", context_lines: 1)
```

### Rendering a Diff

`highlight_diff` renders the change between two sources, with the characters that actually changed picked out within each line:

```ruby
highlighter.highlight_diff(%(<span class='card'>), %(<span class="card">), path: "card.html.erb")
```

```
card.html.erb

  -   1 │ <span class='card'>
  +     │ <span class="card">
```

The line number column refers to the original source throughout, so it stays monotonic even when a fix changes the line count. Added lines have no counterpart there and are left blank.

`highlight_diff_hunks` renders hunks that arrived without their sources, in the shape `git diff` produces:

```ruby
highlighter.highlight_diff_hunks([
  {
    oldStart: 1, oldCount: 1, newStart: 1, newCount: 1,
    lines: [
      { type: "removed", content: %(<span class='card'>), oldLineNumber: 1, newLineNumber: nil },
      { type: "added", content: %(<span class="card">), oldLineNumber: nil, newLineNumber: 1 }
    ]
  }
], path: "card.html.erb")
```

### Options

`highlight` and `highlight_file` take:

| Option | Default | |
|---|---|---|
| `diagnostics` | `[]` | ranges to mark inline |
| `split_diagnostics` | `false` | render one snippet per diagnostic |
| `context_lines` | `0` | lines to keep around a focus line or diagnostic |
| `focus_line` | `nil` | render only the lines around this one |
| `show_line_numbers` | `true` | |
| `wrap_lines` | `true` | |
| `max_width` | terminal width | |
| `truncate_lines` | `false` | cut long lines instead of wrapping them |

`highlight_diagnostic` takes `context_lines`, `show_line_numbers`, `optimize_highlighting`, `wrap_lines`, `max_width`, `truncate_lines`, and the `code_url`, `file_url` and `suffix` strings used for terminal hyperlinks.

`highlight_diff` and `highlight_diff_hunks` take `context_lines`, `show_line_numbers`, `wrap_lines`, `max_width`, `truncate_lines`, `highlight_inline_changes`, `indent`, and three enums:

- `removed_line_style` sets the removed side apart. `:tint` washes it in the theme's removed background, `:dim` fades it the way context lines are faded, `:none` leaves it to the `-` marker alone.
- `single_line_style` chooses whether a one-for-one line replacement is stacked or collapsed onto a single `±` line. `:auto` collapses only where that reads better.
- `layout` chooses between `:unified` and `:split`, which puts the original in a left column and the modified in a right one. Split falls back to unified when the terminal is too narrow.

Collapsing and tinting both need color. With `NO_COLOR` set nothing collapses and nothing is tinted, whatever `single_line_style` says.

Options are handed to the renderer untouched, so it owns the defaults and the validation. An unknown or mistyped option raises `Herb::Highlighter::Error` naming the ones that are valid, rather than being silently dropped.

### CLI

The gem ships the `herb-highlight` binary:

```bash
herb-highlight app/views/users/show.html.erb --theme=tokyo-night --focus=10 --context-lines=3
```

```bash
git diff -- app/views | herb-highlight diff
```

`Herb::Highlighter.executable` resolves the binary path, so you can invoke it yourself. Set `HERB_HIGHLIGHTER_INSTALL_DIR` to point at a binary of your own.

### Errors

- `Herb::Highlighter::Error` is the base class, raised when the renderer rejects its input.
- `Herb::Highlighter::ThemeError` is raised when a theme name or file cannot be resolved.
- `Herb::Highlighter::ExecutableNotFoundError`, `UnsupportedPlatformError` and `CompilationError` come from resolving the CLI binary.

### Development

Dependencies come from the repository's root `Gemfile`, which declares this gem alongside `herb` itself, so `bundle install` runs once at the root for both.

```bash
bundle install
```

```bash
cd gems/herb-highlighter && bundle exec rake
```

`rake` compiles the Rust crate and the C extension, then runs the tests. The same targets are wired into the nx workspace as `herb-highlighter-gem`:

```bash
npx nx run herb-highlighter-gem:test
```

The gem depends on the published [`herb-highlighter`](https://crates.io/crates/herb-highlighter) crate. Inside a monorepo checkout, `rust/.cargo/config.toml` patches that dependency to the working tree at `rust/herb-highlighter/`, so local changes to the crate are picked up without publishing. That file is not part of the packaged gem, which resolves from crates.io like any other consumer.

Because of that, the crate has to be published before a gem of the same version can be installed from source.

### Releasing

```bash
bundle exec rake gem:native
```

builds the precompiled gem for every supported platform through `rake-compiler-dock`. `bundle exec rake gem:arm64-darwin` builds a single one.
