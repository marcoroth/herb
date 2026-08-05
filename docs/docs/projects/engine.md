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
| `parser_options` | `{}` | Options forwarded to the parser (e.g., `{ strict: false }`) |
| `visitors` | `[]` | AST visitors to run before compilation |
| `project_path` | `Dir.pwd` | Project root for relative path resolution |
| `content_for_head` | `nil` | HTML injected before the closing `</head>` tag |
| `validate_ruby` | `false` | Raise if the compiled output isn't valid Ruby |
| `optimize` | `false` | Compile-time optimizations for Action View helpers (experimental) |
| `debug` | `false` | Enable debug mode |

Strict parsing is a parser option rather than an engine option, so it is set through `parser_options`:

```ruby
Herb::Engine.new(source, parser_options: { strict: false })
```

## Validators

The engine runs validators on parsed templates to catch errors before compilation. Each validator can be enabled or disabled via [`.herb.yml` configuration](/configuration#engine-configuration) or per-instance overrides.

| Validator | Description |
|---|---|
| Security | Detects ERB output in unsafe positions (attribute names, attribute positions) |
| Nesting | Validates HTML nesting rules (e.g., no `<div>` inside `<p>`) |
| Accessibility | Validates accessibility-related attributes |

Disable security validator for this template:
```ruby
Herb::Engine.new(source, validators: { security: false })
```

See [Engine Configuration](/configuration#engine-configuration) for `.herb.yml` configuration.

## Validation Mode

Controls how the engine presents validation results:

- **`:raise`** — Raises `SecurityError` or `CompilationError` (default, used in tests and CLI)
- **`:overlay`** — Renders errors as in-browser overlay (used by [ReActionView](https://github.com/marcoroth/reactionview) in development)
- **`:none`** — Skips validation entirely

## Transform Visitors

The `visitors` option accepts [visitors](/bindings/ruby/reference#visitors) that run over the AST before compilation. Transform visitors rewrite the AST, which changes what the compiler emits.

Herb ships the following transform visitors:

| Visitor | Description |
|---|---|
| `AutoCloseOmittedTagsVisitor` | Replaces omitted closing tags with explicit ones |
| `ComponentVisitor` | Rewrites capitalized tags into `render` calls (experimental) |

Transform visitors are not loaded when you `require "herb"`. Require the ones you want and pass them to the engine:

```ruby
require "herb/engine/auto_close_omitted_tags_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::AutoCloseOmittedTagsVisitor.new])
```

Your own visitors are passed the same way. See [Visitors](/bindings/ruby/reference#visitors) for how to write one.

### `AutoCloseOmittedTagsVisitor`

Makes sure the compiled output always contains a closing tag, even when the template omits it.

Given this template:

```html+erb
<ul>
  <li>List Item 1
  <li>List Item 2
</ul>
```

The engine renders:

```html
<ul>
  <li>List Item 1
  </li><li>List Item 2
</li></ul>
```

The closing tag is inserted where the parser determined the element ends, which keeps the surrounding whitespace (and therefore the rendering of `inline-block` elements) identical to the template without the visitor.

### `ComponentVisitor`

> [!WARNING]
> `ComponentVisitor` is experimental and a proof of concept. The generated `render` calls, the attribute mapping, and the class itself may change or be removed without a major version bump. It prints a warning the first time it is instantiated in a process.

Rewrites capitalized tags into `render` calls, so a component can be written as a tag instead of an ERB expression.

```ruby
require "herb/engine/component_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::ComponentVisitor.new])
```

A tag is transformed when its name is CamelCase in every segment. `<DIV>`, `<BR>` and `<My-Component />` are left alone, since uppercase HTML tags are valid HTML.

How the tag is resolved is decided entirely from the tag name, with no lookup at compile time or at render time:

| Tag                           | Separator        | Resolves to                         |
|-------------------------------|------------------|-------------------------------------|
| `<Card />`                    | none             | `render Card.new`                   |
| `<Users::Card />`             | `::`, a constant | `render Users::Card.new`            |
| `<Users.Card />`              | `.`, a path      | `render "users/card"`               |
| `<Admin.Users.ProfileCard />` | `.`, a path      | `render "admin/users/profile_card"` |


Dot notation needs the `dot_notation_tags` parser option for the tag name to parse at all:

```ruby
Herb::Engine.new(source,
  parser_options: { dot_notation_tags: true },
  visitors: [Herb::Engine::ComponentVisitor.new],
)
```

Attribute names are converted from kebab-case to snake_case and become keyword arguments:

| Attribute                  | Becomes                 | Notes                                     |
|----------------------------|-------------------------|-------------------------------------------|
| `name="hello"`             | `name: "hello"`         | Quotes, backslashes and `#{}` are escaped |
| `:count="@count"`          | `count: @count`         | A `:` prefix is used as Ruby code         |
| `name="<%= @user.name %>"` | `name: "#{@user.name}"` | ERB is interpolated into the string       |
| `disabled`                 | `disabled: true`        | An attribute without a value              |
| `item-id="7"`              | `item_id: "7"`          |                                           |

An attribute whose name isn't a valid keyword argument, such as `@click`, is skipped, and the first of a repeated attribute wins.

```html+erb
<MyComponent name="hello" :count="@count" item-id="7" />
```

Compiles to the equivalent of:

```erb
<%= render MyComponent.new(name: "hello", count: @count, item_id: "7") %>
```

For a partial, the same attributes become locals instead of keyword arguments:

```html+erb
<Users.Card name="hello" :count="@count" />
```

```erb
<%= render "users/card", name: "hello", count: @count %>
```

A tag with a body becomes a block, and the body is compiled as normal, so it can contain HTML, ERB, and further components:

```html+erb
<Card title="Hello">
  <div>Regular HTML</div>
  <%= @thing %>
  <Button>Nested component</Button>
</Card>
```

```erb
<%= render Card.new(title: "Hello") do %>
  <div>Regular HTML</div>
  <%= @thing %>
  <%= render Button.new do %>Nested component<% end %>
<% end %>
```

A partial with a body is rendered as a layout, so the body reaches the partial through `yield`:

```html+erb
<Users.Card title="Hello">Body</Users.Card>
```

```erb
<%= render layout: "users/card", locals: { title: "Hello" } do %>Body<% end %>
```

## ReActionView Integration

[ReActionView](https://github.com/marcoroth/reactionview) registers `Herb::Engine` as the template handler for `.html.erb` and `.html.herb` files in Rails. It uses `validation_mode: :overlay` so validation errors appear as in-browser overlays during development instead of raising exceptions.

Validator settings from `.herb.yml` are respected automatically — no ReActionView-specific configuration needed.

ReActionView also lets you run transform visitors on every template it compiles, through `config.transform_visitors`:

```ruby
# config/initializers/reactionview.rb
require "herb/engine/auto_close_omitted_tags_visitor"

ReActionView.configure do |config|
  config.transform_visitors = [
    Herb::Engine::AutoCloseOmittedTagsVisitor.new
  ]
end
```
