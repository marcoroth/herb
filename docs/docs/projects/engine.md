# `Herb::Engine` <Badge type="tip" text="v0.7.0+" />

`Herb::Engine` is a drop-in replacement for [`Erubi::Engine`](https://github.com/jeremyevans/erubi) that compiles HTML+ERB templates into Ruby code. It extends Erubi's functionality with HTML-aware parsing, validation, and security checks.

## Usage

Basic usage (same as `Erubi::Engine`):

```ruby
engine = Herb::Engine.new(source)
puts engine.src
```

With options:
```ruby
engine = Herb::Engine.new(source,
  filename: "app/views/users/show.html.erb",
  escape: true,
)
```

## Erubi Compatibility

`Herb::Engine` accepts all the same options as `Erubi::Engine`:

- `bufvar` / `outvar` — Buffer variable name
- `bufval` — Initial buffer value
- `escape` / `escape_html` — Whether `<%= %>` escapes by default
- `escapefunc` — Escape function name
- `filename` — Template filename
- `freeze` — Add frozen string literal comment
- `freeze_template_literals` — Freeze template string literals
- `preamble` / `postamble` — Custom preamble/postamble
- `chain_appends` — Chain `<<` calls for performance
- `ensure` — Wrap in begin/ensure block
- `src` — Initial source string

## Herb-Specific Options

In addition to Erubi options, `Herb::Engine` supports:

| Option | Default | Description |
|---|---|---|
| `validation_mode` | `:raise` | How to handle validation errors: `:raise`, `:overlay`, or `:none` |
| `validators` | `{}` | Per-validator overrides (e.g., `{ security: false }`) |
| `strict` | `true` | Whether to use strict parsing mode |
| `visitors` | `[]` | AST visitors to run before compilation |
| `project_path` | `Dir.pwd` | Project root for relative path resolution |
| `debug` | `false` | Enable debug mode |

## Validators

The engine runs validators on parsed templates to catch errors before compilation. Each validator can be enabled or disabled via [`.herb.yaml` configuration](/configuration#engine-configuration) or per-instance overrides.

| Validator | Description |
|---|---|
| Security | Detects ERB output in unsafe positions (attribute names, attribute positions) |
| Nesting | Validates HTML nesting rules (e.g., no `<div>` inside `<p>`) |
| Accessibility | Validates accessibility-related attributes |

Disable security validator for this template:
```ruby
Herb::Engine.new(source, validators: { security: false })
```

See [Engine Configuration](/configuration#engine-configuration) for `.herb.yaml` configuration.

## Validation Mode

Controls how the engine presents validation results:

- **`:raise`** — Raises `SecurityError` or `CompilationError` (default, used in tests and CLI)
- **`:overlay`** — Renders errors as in-browser overlay (used by [ReActionView](https://github.com/marcoroth/reactionview) in development)
- **`:none`** — Skips validation entirely

## ReActionView Integration

[ReActionView](https://github.com/marcoroth/reactionview) registers `Herb::Engine` as the template handler for `.html.erb` and `.html.herb` files in Rails. It uses `validation_mode: :overlay` so validation errors appear as in-browser overlays during development instead of raising exceptions.

Validator settings from `.herb.yaml` are respected automatically — no ReActionView-specific configuration needed.
