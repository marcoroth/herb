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

| Option            | Default   | Description                                                                           |
|-------------------|-----------|---------------------------------------------------------------------------------------|
| `validation_mode` | `:raise`  | How to handle validation errors: `:raise`, `:overlay`, or `:none`                     |
| `validators`      | `{}`      | Per-validator overrides (e.g., `{ security: false }`)                                 |
| `parser_options`  | `{}`      | [Parser options](/parser-options) forwarded to the parser (e.g., `{ strict: false }`) |
| `visitors`        | `[]`      | AST visitors to run before compilation                                                |
| `context`         | `{}`      | Extra keys to pass through to the visitors (see [Visitor context](#visitor-context))   |
| `project_path`    | `Dir.pwd` | Project root for relative path resolution                                             |
| `validate_ruby`   | `false`   | Raise if the compiled output isn't valid Ruby                                         |
| `optimize`        | `false`   | Compile-time optimizations for Action View helpers (experimental)                     |
| `debug`           | `false`   | Enable debug mode                                                                     |

Strict parsing is a parser option rather than an engine option, so it is set through `parser_options`, together with any other [parser option](/parser-options):

```ruby
Herb::Engine.new(source, parser_options: { strict: false })
```

## Validators

The engine runs validators on parsed templates to catch errors before compilation. Each validator can be enabled or disabled via [`.herb.yml` configuration](/configuration#engine-configuration) or per-instance overrides.

| Validator     | Description                                                                   |
|---------------|-------------------------------------------------------------------------------|
| Security      | Detects ERB output in unsafe positions (attribute names, attribute positions) |
| Nesting       | Validates HTML nesting rules (e.g., no `<div>` inside `<p>`)                  |
| Accessibility | Validates accessibility-related attributes                                    |

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

| Visitor                       | Description                                                  |
|-------------------------------|--------------------------------------------------------------|
| `AutoCloseOmittedTagsVisitor` | Replaces omitted closing tags with explicit ones             |
| `ContentForVisitor`           | Appends HTML to the end of every matching element            |
| `HTMLSafeAssertionsVisitor`   | Checks every `.html_safe` call at runtime                    |
| `ComponentVisitor`            | Rewrites capitalized tags into `render` calls (experimental) |

Transform visitors are not loaded when you `require "herb"`. Require the ones you want and pass them to the engine:

```ruby
require "herb/engine/auto_close_omitted_tags_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::AutoCloseOmittedTagsVisitor.new])
```

Your own visitors are passed the same way. See [Visitors](/bindings/ruby/reference#visitors) for how to write one.

A visitor that needs the AST to carry more than the defaults can say so with `required_parser_option`, and one that only works better that way with `recommended_parser_option`:

```ruby
class PrismProgramVisitor < Herb::Visitor
  required_parser_option prism_program: true
  recommended_parser_option strict: false
end
```

The engine turns both on before it parses, so passing the visitor is all it takes. What differs is how a conflict with the [parser options](/parser-options) passed to the engine is settled:

| Declaration                  | Option not passed to the engine | Passed with the same value | Passed with a different value                |
|------------------------------|---------------------------------|----------------------------|----------------------------------------------|
| `required_parser_option`     | The engine turns it on          | Nothing to settle          | Raises `ArgumentError`                       |
| `recommended_parser_option`  | The engine turns it on          | Nothing to settle          | Warns, and the value passed to the engine wins |

A requirement raises because a visitor that doesn't get it can't do its work, and silently overriding what you asked for would be worse than saying so. Two visitors requiring the same option differently raises for the same reason.

Every declaration adds to the ones a parent class made, and a subclass can override an inherited value by declaring it again. `required_parser_options` and `recommended_parser_options` return what a visitor ends up asking for.

Both declarations come from `Herb::Visitor::ParserOptionRequirements`, which `Herb::Visitor` includes. A class that is passed to the engine as a visitor without inheriting from `Herb::Visitor` can include it as well.

The engine settles this through `Herb::Visitor.parser_options_for`, which takes the visitors and the options to start from and returns what to parse with. Anything else that runs a set of visitors over a document it parses itself can use it the same way:

```ruby
parser_options = Herb::Visitor.parser_options_for(visitors, strict: false)
result = Herb.parse(source, **parser_options)

visitors.each { |visitor| result.visit(visitor) }
```

### Visitor context

A visitor that includes `Herb::Engine::ContextAware` is handed a `Herb::Engine::VisitorContext` before the engine walks the AST, so it doesn't have to be told things the engine already knows:

```ruby
class MyVisitor < Herb::Visitor
  include Herb::Engine::ContextAware

  def visit_html_element_node(node)
    context.relative_file_path #=> "app/views/users/show.html.erb"
    context.file_path          #=> #<Pathname:app/views/users/show.html.erb>
    context.project_path       #=> #<Pathname:/my/project>
    context.options[:escape]   #=> true

    super
  end
end

Herb::Engine.new(source, filename: "app/views/users/show.html.erb", visitors: [MyVisitor.new])
```

`relative_file_path` is the file path resolved against `project_path`, and is `"unknown"` when there is no file path. `file_path` stays exactly as it was given, so a visitor can still match on how the path was written. It is named `file_path` rather than `filename` because it holds a path, not a base name. The engine option keeps the name `filename` for [Erubi compatibility](#erubi-compatibility). `options` holds the options the engine was built with, without `visitors` and `src`.

Pass `context` to the engine to add your own keys, reachable with `#[]` and `#fetch`:

```ruby
Herb::Engine.new(source, context: { theme: "dark" }, visitors: [MyVisitor.new])

# inside the visitor
context[:theme]              #=> "dark"
context.fetch(:missing, 1)   #=> 1
```

A context is immutable, and `#merge` returns a new one. Setting `context=` yourself always wins over the engine, which is what lets a visitor run standalone against any AST:

```ruby
visitor = MyVisitor.new
visitor.context = Herb::Engine::VisitorContext.new(file_path: "app/views/users/show.html.erb")

Herb.parse(source).value.accept(visitor)
```

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

### `ContentForVisitor`

Appends HTML to the end of every element matching a tag name, so that it ends up right before that element's closing tag.

```ruby
require "herb/engine/content_for_visitor"

Herb::Engine.new(source, visitors: [
  Herb::Engine::ContentForVisitor.new("<p>Footer</p>", tag_name: "main")
])
```

Tag names are matched case-insensitively, and every matching element in the template gets the content, including nested ones.

Pass `attributes` to narrow which elements match. Every condition in the hash has to hold:

```ruby
Herb::Engine::ContentForVisitor.new(
  "<p>Footer</p>",
  tag_name: "main",
  attributes: { "id" => "content", "data-role" => /page/, "hidden" => false }
)
```

| Condition     | Matches when                                 |
|---------------|----------------------------------------------|
| `true`        | The attribute is present, whatever its value |
| `false`       | The attribute is absent                      |
| A `Regexp`    | The attribute value matches it               |
| Anything else | The attribute value is equal to it           |

Attribute names are matched case-insensitively, and may be given as strings or symbols. An attribute whose value is built from ERB has no value known at compile time, so it matches `true` but never a string or `Regexp` condition.

Multiple visitors compose, and each appends after the last, in the order you pass them.

Given this template and a visitor for the `head` tag:

```html+erb
<head>
  <title>Hello</title>
</head>
```

The engine renders:

```html
<head>
  <title>Hello</title>
<meta name="herb" content="1"></head>
```

The content is emitted as a Ruby string literal marked `html_safe`, so it is never escaped, and quotes, backslashes and `#{}` in it are not interpreted.

### `HTMLSafeAssertionsVisitor`

Wraps the receiver of every `.html_safe` call in a template with a runtime assertion, so that marking a value as HTML-safe raises when the value contains HTML that the browser executes.

```ruby
require "herb/engine/html_safe_assertions_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::HTMLSafeAssertionsVisitor.new])
```

This template:

```html+erb
<div><%= @user.bio.html_safe %></div>
```

Compiles as if it had been written as:

```html+erb
<div><%= ::Herb::Engine::HTMLSafeAssertions.check(@user.bio, file: __FILE__, line: 1, column: 6, source: "<%= @user.bio.html_safe %>", mode: :raise).html_safe %></div>
```

The value keeps flowing through `.html_safe` unchanged, and the assertion runs on every render. A value that is already HTML-safe is never checked, since `.html_safe` is a no-op on it.

The calls are found in the Prism program that the [`prism_program`](/parser-options) parser option attaches to the document, so a call is wrapped wherever it appears, including in control flow such as `<% elsif b.html_safe %>`. Calls inside an ERB comment are not wrapped, since they are not part of the program. The visitor declares the option through `required_parser_option`, which the engine turns on for it. Parsing an AST for this visitor by hand needs the same option:

```ruby
Herb.parse(source, prism_program: true)
```

The error surfaces while the template renders, not while it compiles, unlike the ones the [validators](#validators) raise. Rendering the template with a bio of `<script>alert(1)</script>` raises `Herb::Engine::HTMLSafeAssertions::UnsafeHTMLError`:

```
Unsafe `.html_safe` call in app/views/users/show.html.erb:1:6

    <%= @user.bio.html_safe %>

The value contains a `<script>` element, which the browser executes.

    "<script>alert(1)</script>"

Escape the value or run it through `sanitize` instead of marking it as HTML-safe.
```

The value is checked against these heuristics:

| Check            | Reports                                                           |
|------------------|-------------------------------------------------------------------|
| `script_element` | A `<script>` element                                              |
| `event_handler`  | An inline event handler attribute, such as `onerror` or `onclick` |
| `javascript_url` | A `javascript:` or `vbscript:` URL                                |
| `data_url`       | A `data:text/html` URL                                            |
| `risky_element`  | An `<iframe>`, `<object>`, `<embed>`, `<base>` or `<portal>`      |
| `meta_refresh`   | A `<meta http-equiv="refresh">` element                           |

The visitor takes the following options:

| Option      | Default  | Description                                                                             |
|-------------|----------|-----------------------------------------------------------------------------------------|
| `mode`      | `:raise` | `:raise` raises on a violation, `:warn` warns and keeps rendering                       |
| `ignore`    | `[]`     | Checks to skip, given by name                                                           |
| `file_path` | `nil`    | Path baked into the assertion. Defaults to `__FILE__`, which Rails sets to the template |

```ruby
Herb::Engine::HTMLSafeAssertionsVisitor.new(mode: :warn, ignore: [:risky_element])
```

Set `on_violation` to report violations somewhere else instead of raising or warning. It receives the same error object, and is consulted before `mode`:

```ruby
Herb::Engine::HTMLSafeAssertions.on_violation = ->(error) do
  ErrorTracking.capture_exception(error)
end
```

`.html_safe` passed as a block argument has no receiver to wrap, so the symbol becomes a block that checks every element it is called with:

```html+erb
<%= items.map(&:html_safe).join %>
```

```html+erb
<%= items.map(&proc { |value| ::Herb::Engine::HTMLSafeAssertions.check(value, ...).html_safe }).join %>
```

Since the assertions run on every render, this visitor is meant for development and test environments. In production, either leave it out or run it with `mode: :warn`.

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


Dot notation needs the [`dot_notation_tags`](/parser-options) parser option for the tag name to parse at all:

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
