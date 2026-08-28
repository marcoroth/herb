# `Herb::Engine` <Badge type="tip" text="v0.7.0+" />

`Herb::Engine` is a drop-in replacement for [`Erubi::Engine`](https://github.com/jeremyevans/erubi) that compiles HTML+ERB templates into Ruby code. It extends Erubi's functionality with HTML-aware parsing, validation, and security checks.

## Usage

The engine is not loaded by `require "herb"`. Require it explicitly:

```ruby
require "herb/engine"
```

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

`Herb::Engine` targets [`Erubi::Engine`](https://github.com/jeremyevans/erubi) running with its default options. It does not target Ruby's standard-library `ERB`, which uses a different set of trim modes and produces different output for the same template. A template that compiles under Erubi is expected to render the same under Herb. The [Erubi compatibility suite](https://github.com/marcoroth/herb/blob/main/test/engine/engine_erubi_compat_test.rb) holds the cases where the compiled Ruby matches byte for byte, and the [divergence suite](https://github.com/marcoroth/herb/blob/main/test/engine/engine_erubi_divergence_test.rb) pins the cases where it does not.

Rails is not part of that contract. `Herb::Engine` is a plain Ruby class with no Rails dependency, so it works anywhere you can hand a framework its own ERB engine. The Rails-specific pieces (Action View helpers, `content_for`, partial rendering) live in [visitors](#transform-visitors) you opt into, and in [ReActionView](#reactionview-integration).

If a framework renders `.erb` files through the standard-library `ERB` by default, neither Erubi nor Herb applies until it is configured to use the engine. That configuration is the framework's, not Herb's.

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

### Whitespace trimming

Erubi's `trim` behavior is always on and is not configurable. A `<% %>` tag that stands alone on its line drops the newline that follows it, and `-%>` drops it wherever the tag sits. `<%-` is accepted and leaves the whitespace in front of the tag alone, which is what Erubi does with it too. Trimming is what makes a `case` written across several tags compile:

```erb
<% case status %>
<% when :active %>
  <span class="badge">Active</span>
<% when :archived %>
  <em>Archived</em>
<% else %>
  Unknown
<% end %>
```

The newline after `<% case status %>` is trimmed, so nothing lands between `case` and its first `when`, and the compiled Ruby is valid. Herb and Erubi emit byte-identical output here. Passing `trim: false` has no effect, whereas Erubi would honor it and emit a buffer append between the two tags.

### Known differences from Erubi

Three things that `Erubi::Engine` accepts are handled differently by `Herb::Engine` on its default settings. Each one is deliberate.

A `case` with its first `when`/`in` in the same ERB tag raises `ERB_CASE_WITH_CONDITIONS_ERROR` under [strict parsing](/parser-options). The AST that pattern produces cannot be formatted or compiled reliably. The [`erb-no-inline-case-conditions`](/linter/rules/erb-no-inline-case-conditions.md) rule reports the same thing.

Escaped tags such as `<%% %>` and `<%%= %>` raise `Herb::Engine::GeneratorTemplateError`. A template that emits literal ERB is a generator template, not a template to render.

`trim: false` is ignored and trimming stays on. Herb's whitespace handling is tied to the parsed AST, not to a scanner mode.

One difference changes what a template renders. Erubi calls `to_s` on every `<%= %>` wherever it sits, because it never looks at the markup around the tag. Herb parses the HTML, so it knows the tag's context and escapes for it:

```erb
<input name="<%= field_name %>">
```

```ruby
_buf << ::Herb::Engine.attr((field_name));
```

Erubi compiles that same tag to `( field_name ).to_s`, so a value carrying `a" onload="alert(1)` escapes out of the attribute under Erubi and does not under Herb. A tag inside `<script>` gets `::Herb::Engine.js` and one inside `<style>` gets `::Herb::Engine.css` for the same reason. The three come from the `attrfunc`, `jsfunc`, and `cssfunc` options, which take the same shape as Erubi's `escapefunc`.

The rest are formatting differences in output that renders identically. Herb writes `(title)` where Erubi writes `( title )`, escapes through `::Herb::Engine` instead of `::Erubi` and leaves that constant out when no tag in the template escapes, drops the blank line Erubi leaves where an ERB comment was, and inserts the `;` after a `preamble` that does not end in one, which Erubi leaves as a syntax error. Each of those is a test in the divergence suite.

The `case` guard is the one worth knowing about outside Rails, because writing the whole statement in one tag is a common way to sidestep the untrimmed-newline problem in engines that do not trim:

```erb
<% case status
when :active %>
  <span class="badge">Active</span>
<% end %>
```

Turning strict parsing off compiles it, byte-identically to Erubi:

```ruby
Herb::Engine.new(source, parser_options: { strict: false })
```

Since Herb trims, the conventional form with `case` and `when` in separate tags already works, and it is the form the formatter and the linter are built around.

The linter is configured separately from the engine. Set [`framework`](/configuration#framework-configuration) in `.herb.yml` so rules that assume Action View stay quiet in a project that is not running it.

### Blocks

`<%= %>` with a block compiles so that the block body writes into the buffer directly:

```erb
<%= wrapper do %>
  <p>hi</p>
<% end %>
```

```ruby
_buf = ::String.new; _buf << (wrapper do; _buf << '
  <p>hi</p>
'.freeze; end )
_buf.to_s
```

Plain `Erubi::Engine` compiles this template to invalid Ruby, since it closes the append before the block body. [`Erubi::CaptureBlockEngine`](https://github.com/jeremyevans/erubi#capturing) is the engine that handles it, and Herb generates the same structure it does. The two differ only in the append operator, `<<=` where Herb writes `<<`, and those are equivalent here because `<<=` expands to `buffer = buffer << value` and the buffer returns itself.

What `Erubi::CaptureBlockEngine` really contributes is its buffer. `Erubi::CaptureBlockEngine::Buffer` is a `String` subclass with a `capture` method, which empties the buffer, runs the block, and returns what the block wrote. A helper calls it to get the block's content:

```ruby
def upcase_form(&block)
  "<form>#{@bufvar.capture(&block).upcase}</form>"
end
```

Herb's default `bufval` is `::String.new`, which has no `capture`. Point it at a capture-aware buffer and helpers written for `Erubi::CaptureBlockEngine` work unchanged:

```ruby
Herb::Engine.new(source,
  bufvar: "@bufvar",
  bufval: "::Erubi::CaptureBlockEngine::Buffer.new",
)
```

Rendering then matches `Erubi::CaptureBlockEngine` for nested blocks, escaping tags inside a block, and text around one. Action View supplies its own capture-aware buffer, which is why block helpers work there without any of this. A helper that only calls `yield` and interpolates the result renders the block's content twice, once from the direct write and once from the value it returns.

## Herb-Specific Options

In addition to Erubi options, `Herb::Engine` supports:

| Option            | Default   | Description                                                                           |
|-------------------|-----------|---------------------------------------------------------------------------------------|
| `parser_options`  | `{}`      | [Parser options](/parser-options) forwarded to the parser (e.g., `{ strict: false }`) |
| `visitors`        | `[]`      | AST visitors to run before compilation                                                |
| `context`         | `{}`      | Extra keys to pass through to the visitors (see [Visitor context](#visitor-context))  |
| `project_path`    | `Dir.pwd` | Project root for relative path resolution                                             |
| `validate_ruby`   | `false`   | Raise if the compiled output isn't valid Ruby                                         |

The engine compiles whatever passes it is given and holds no opinion beyond that. Validation, debug annotations, and Action View optimizations are all visitors you pass in `visitors`, so there is no option to turn any of them on.

Strict parsing is a parser option rather than an engine option, so it is set through `parser_options`, together with any other [parser option](/parser-options):

```ruby
Herb::Engine.new(source, parser_options: { strict: false })
```

## Validators

Validators check a parsed template and report what they find. They are ordinary visitors, so nothing runs unless you pass it.

| Validator                | Description                                                                   |
|--------------------------|-------------------------------------------------------------------------------|
| `SecurityValidator`      | Detects ERB output in unsafe positions (attribute names, attribute positions) |
| `NestingValidator`       | Validates HTML nesting rules (e.g., no `<div>` inside `<p>`)                  |
| `AccessibilityValidator` | Validates accessibility-related attributes                                    |
| `RenderValidator`        | Validates `render` calls                                                      |

`Validators.all` builds the set a project has switched on in [`.herb.yml`](/configuration#engine-configuration), which is the usual way to ask for them:

```ruby
require "herb/engine/validators"

Herb::Engine.new(source, visitors: Herb::Engine::Validators.all)
```

It takes the same per-validator overrides, so a template can opt out of one:

```ruby
Herb::Engine.new(source, visitors: Herb::Engine::Validators.all(security: false))
```

A caller that already knows what it wants can skip the configuration lookup and name them directly.

```ruby
require "herb/engine/validators/security_validator"

Herb::Engine.new(source, visitors: [Herb::Engine::Validators::SecurityValidator.new])
```

### Whether a finding refuses to compile

Each validator decides that for itself, through `fatal:`. A fatal validator aborts compilation when it reports an error. One that is not fatal reports the same thing and lets the template compile, so the page still renders and the finding reaches the browser instead.

```ruby
Herb::Engine::Validators.all(fatal: false)
```

Validators are fatal by default. Which exception gets raised is the validator's own choice rather than something the engine infers from its class name, so `SecurityValidator` aborts with `Herb::Engine::SecurityError` while a validator that names no exception aborts with `Herb::Engine::CompilationError`.

Because this is decided per validator rather than per engine, one compile can mix the two. Security problems can refuse to compile while accessibility findings only get reported:

```ruby
Herb::Engine.new(
  source,
  visitors: [
    Herb::Engine::Validators::SecurityValidator.new(fatal: true),
    Herb::Engine::Validators::AccessibilityValidator.new(fatal: false)
  ]
)
```

### Ordering

`Validators.all` returns a `Herb::Engine::VisitorStack`, an ordered list that also accepts anything else you want to run:

```ruby
stack = Herb::Engine::Validators.all
stack.use(MyVisitor.new)
stack.insert_after(Herb::Engine::Validators::SecurityValidator, MyOtherVisitor.new)
```

`use` appends, `insert` and `insert_after` place a visitor relative to another one by class, and `include_visitor?` asks whether one is already there. Naming a class that is not in the stack raises `Herb::Engine::VisitorStack::UnknownVisitorError` rather than putting it somewhere arbitrary.

## Transform Visitors

The `visitors` option accepts [visitors](/bindings/ruby/reference#visitors) that run over the AST before compilation. Transform visitors rewrite the AST, which changes what the compiler emits.

Herb ships the following transform visitors:

| Visitor                          | Description                                                                  |
|----------------------------------|------------------------------------------------------------------------------|
| `Visitors::AutoCloseOmittedTags` | Replaces omitted closing tags with explicit ones                             |
| `Visitors::ContentFor`           | Appends HTML to the end of every matching element                            |
| `Visitors::RemoveComments`       | Removes comments, so the output never contains one                           |
| `Visitors::HTMLSafeAssertions`   | Checks every `.html_safe` call at runtime                                    |
| `Visitors::Component`            | Rewrites capitalized tags into `render` calls (experimental)                 |
| `Visitors::Debug`                | Annotates output with the template and position it came from                 |
| `Visitors::Optimize`             | Compile-time optimizations for Action View helpers (experimental)            |
| `Visitors::Instrumentation`      | Frames every ERB tag so a render can be attributed to it (experimental)      |
| `Visitors::InlineRender`         | Replaces a `render` of a static partial with the partial (experimental)      |
| `ScopedStyle::Visitor`           | Scopes a `<style scoped>` block to the file it was written in (experimental) |

Transform visitors are not loaded when you `require "herb"`. Require the ones you want and pass them to the engine:

```ruby
require "herb/engine/visitors/auto_close_omitted_tags"

Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::AutoCloseOmittedTags.new])
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

### Run order

Visitors run in the order they are given, and for most of them that order does not matter. It does when one visitor reads the ERB a template was written with and another rewrites it, because the reader would then be handed Herb's generated code where the author's tag should be.

A visitor says which of the two it is by answering on its class:

```ruby
class MyReadingVisitor < Herb::Visitor
  def self.reads_erb_source? = true
end
```

`reads_erb_source?` means it copies the template's own ERB somewhere, the way `Visitors::Debug` puts it in `data-herb-debug-erb`. `rewrites_erb_source?` means it leaves ERB behind that the author did not write, the way `Visitors::Instrumentation` wraps every tag. A visitor that answers neither is unconstrained and can run anywhere.

A third question, `inlines_renders?`, means the visitor brings markup from other files into the tree, the way `Visitors::InlineRender` does. One that answers it has to run first, so everything else sees what it brought in.

The engine checks this before it compiles anything, so a stack in the wrong order raises rather than producing a template that is quietly wrong:

```ruby
Herb::Engine.new(source, visitors: [
  Herb::Engine::Visitors::Instrumentation.new,
  Herb::Engine::Visitors::Debug.new
])
# => Herb::Engine::VisitorStack::OrderError
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

### `Visitors::AutoCloseOmittedTags`

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

### `Visitors::RemoveComments`

Removes comments, so that the compiled output never contains one.

An HTML comment is served to the browser and is readable by anyone who looks at the page source, so a note the template author wrote for other developers ends up in production.

```ruby
require "herb/engine/visitors/remove_comments"

Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::RemoveComments.new])
```

Given this template:

```html+erb
<div>
  <p><%= product.name %></p><!-- TODO: drop this once the new checkout ships -->
</div>
```

The engine renders:

```html
<div>
  <p>Coffee</p>
</div>
```

Everything nested inside a comment goes with it, so ERB written inside one is removed before it is compiled and never runs. A conditional comment is an HTML comment too, which means the markup it guards is removed along with it.

ERB comments go as well. The compiler already leaves `<%# comment %>` and `<% # comment %>` out of the output on its own, so removing them makes it something the template is guaranteed instead of something the compiler happens to do.

What Herb writes to itself is not a comment. A directive is an ERB comment whose content starts with `herb:` or `locals:`, which makes it an instruction to Herb or to Action View instead of a note for people, so `<%# herb:state (pending: false) %>`, `<%# herb:key user.id %>`, `<%# herb:disable html-tag-name-lowercase %>` and `<%# locals: (title:) %>` all stay where they are. The compiler leaves them out of the output the way it leaves any ERB comment out.

A marker is an HTML comment naming `herb-`, which is how a pass hands something to the browser, the way `Slots::Visitor` writes `<!--herb-slot:0-->` around a slot. Markers stay, in the output as well, so the visitor can go anywhere in the stack:

```ruby
Herb::Engine.new(source, visitors: [
  Herb::Engine::Visitors::RemoveComments.new,
  Herb::Engine::Slots::Visitor.new
])
```

Either order renders the same markup, with the template's own comments gone and every slot marker left in place.

The whitespace around a comment is left where it was, so removing one never changes how the elements next to it are laid out. A comment on a line of its own leaves that line's whitespace behind. That includes an ERB comment, where the compiler on its own would have trimmed the line away.

Comment syntax inside a `<script>` or `<style>` element is part of that element's text instead of an HTML comment, so it stays.

### `Visitors::ContentFor`

Appends HTML to the end of every element matching a tag name, so that it ends up right before that element's closing tag.

```ruby
require "herb/engine/visitors/content_for"

Herb::Engine.new(source, visitors: [
  Herb::Engine::Visitors::ContentFor.new("<p>Footer</p>", tag_name: "main")
])
```

Tag names are matched case-insensitively, and every matching element in the template gets the content, including nested ones.

Pass `attributes` to narrow which elements match. Every condition in the hash has to hold:

```ruby
Herb::Engine::Visitors::ContentFor.new(
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

### `Visitors::HTMLSafeAssertions`

Wraps the receiver of every `.html_safe` call in a template with a runtime assertion, so that marking a value as HTML-safe raises when the value contains HTML that the browser executes.

```ruby
require "herb/engine/visitors/html_safe_assertions"

Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::HTMLSafeAssertions.new])
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
Herb::Engine::Visitors::HTMLSafeAssertions.new(mode: :warn, ignore: [:risky_element])
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

### `Visitors::Component`

> [!WARNING]
> `Visitors::Component` is experimental and a proof of concept. The generated `render` calls, the attribute mapping, and the class itself may change or be removed without a major version bump. It prints a warning the first time it is instantiated in a process.

Rewrites capitalized tags into `render` calls, so a component can be written as a tag instead of an ERB expression.

```ruby
require "herb/engine/visitors/component"

Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::Component.new])
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
  visitors: [Herb::Engine::Visitors::Component.new],
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

### `Visitors::Debug`

Annotates the rendered output with where it came from, so a rendered element can be traced back to the tag that produced it.

```ruby
require "herb/engine/visitors/debug"

Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::Debug.new])
```

The first top-level element of a template carries which template it is, and each ERB output tag is wrapped in a `<span style="display: contents">` carrying where in that template it was written:

| Attribute                            | On      | Says                                              |
|--------------------------------------|---------|---------------------------------------------------|
| `data-herb-debug-file-relative-path` | element | which template this is                            |
| `data-herb-debug-file-name`          | element | its basename                                      |
| `data-herb-debug-file-full-path`     | element | its full path                                     |
| `data-herb-debug-outline-type`       | both    | whether it is a view, a partial, or an ERB output |
| `data-herb-debug-attach-to-parent`   | element | that the template has more than one root          |
| `data-herb-debug-inserted`           | span    | that this span is Herb's and not the author's     |
| `data-herb-debug-erb`                | span    | the tag as it was written                         |
| `data-herb-debug-line`, `-column`    | span    | where that tag is                                 |
| `data-herb-debug-node`               | both    | which render this was, with `node: true`          |

### Tracing rendered output back to a tag

`<%= link_to "Abc", "" %>` produces an `<a>` that says nothing about where it came from. Wrapping it says so:

```html
<span
  data-herb-debug-inserted="true"
  data-herb-debug-line="2"
  data-herb-debug-column="7"
  data-herb-debug-erb="&lt;%= link_to &quot;Abc&quot;, &quot;&quot; %&gt;"
  style="display: contents;"
>
  <a href="">Abc</a>
</span>
```

Anything looking at the rendered page, such as a linter running over the response, walks up from the element it has a finding about and takes the first marker it meets:

| Nearest marker                         | What it can say                  |
|----------------------------------------|----------------------------------|
| `[data-herb-debug-inserted]`           | the tag, and its line and column |
| `[data-herb-debug-file-relative-path]` | only the template                |
| neither                                | nothing                          |

Not every element ends up under a marker. An element written as plain HTML has no tag to name, an ERB tag inside an attribute value cannot be wrapped in a span, a template with more than one root only marks the first, and helpers that take a block are skipped. Treat a missing marker as unattributed rather than assuming coverage.

`node: true` adds the render as well, which needs `Visitors::Instrumentation` in the same stack to have anything to report:

```ruby
Herb::Engine.new(source, visitors: [
  Herb::Engine::Visitors::Debug.new(node: true),
  Herb::Engine::Visitors::Instrumentation.new
])
```

Without it the markers say only where in a file something was written, so a partial rendered three times puts three identical ones in the page. With it each carries the render it belongs to, which is what tells them apart.

The wrapper is a real cost. A `<span>` is not valid everywhere an ERB tag can appear, `<ul>` being the obvious case, so a strict linter reading the rendered page will have findings about Herb's own instrumentation.

### `Visitors::Optimize` <Badge type="warning" text="experimental" />

Asks the parser to resolve Action View helpers into the markup they produce, so the compiler emits that markup instead of a call the renderer has to make.

```ruby
require "herb/engine/visitors/optimize"

Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::Optimize.new])
```

`<%= tag.div do %>Content<% end %>` compiles to `<div>Content</div>` with no helper call left at all. Only the helpers the registry marks supported are resolved.

Its presence also collapses a template that carries no Ruby into the single string literal it renders, with none of the buffer the compiler would otherwise build up. `<div>Static</div>` compiles to `'<div>Static</div>'`. A template written as HTML qualifies on its own, and one left fully static once its helpers resolved to markup qualifies too, so `<%= tag.br %>` compiles to `'<br>'`. The engine keeps the buffer when the caller drives it through `preamble`, `postamble`, `bufval`, or `ensure`, and when a visitor recorded a diagnostic the compiled template still has to report.

Replacing a helper call with its markup is the same thing as calling it only while the helper is the one it was resolved against. An application that defines its own `content_tag` gets the stock markup everywhere instead of its own, with nothing at the call site to say so. `verify` compiles a check into the template that reports a helper that has since been overwritten:

```ruby
Herb::Engine::Visitors::Optimize.new(verify: true)
```

It reports rather than raises, because the markup is already rendered by the time the check runs:

```
app/views/posts/index.html.erb:1:1: [overwritten-helper] `tag` was compiled away as
ActionView::Helpers::TagHelper, but here it is defined by ApplicationHelper.
```

The check costs a call per render and only reports, so it belongs in development rather than production, and compiling it in is opt-in for the same reason the optimization is.

### `Visitors::InlineRender` <Badge type="warning" text="experimental" />

Replaces a `render` of a static partial with the partial itself, so the rendered page costs no partial lookup at run time.

```ruby
require "herb/engine/visitors/inline_render"

Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::InlineRender.new])
```

`<%= render partial: "posts/card", locals: { title: @post.title } %>` compiles to the card's own markup, inside a lambda that takes the locals it was given as parameters:

```ruby
->(title) { _buf << '<div>'.freeze; _buf << (title).to_s; _buf << '</div>'.freeze; }.call((@post.title))
```

The lambda is what scopes them. A partial only ever sees the locals it was passed, so the copy has to work the same way, and a lambda's parameters are what make that true of the copy.

The locals a partial assigns for *itself* are declared block-local on the same lambda, so they do not reach the template's either:

```ruby
->(title; total) { ... }.call((@post.title))
```

`Prism` reports those from the partial's own source, which is exact rather than a guess. Without them a partial assigning a name the template already had a local for would assign over the template's, because a block body shares the locals around it rather than making its own.

A partial is inlined only when the file it names is knowable and inlining it means what the original did. That rules out a dynamic path, a block, `content_for`, `yield`, `local_assigns`, and one already being inlined further up, and it also rules out several things that are answered by where a partial is rather than by what it says:

| Left alone | Because |
|------------|---------|
| `t(".title")`, `l(...)`, `I18n.t` | The lookup is keyed on `@virtual_path`, which would become the template's |
| `card_iteration` | Rails binds it per item; the copy has only the counter |
| A name the template has a local for | The copy would read the local rather than call the method of that name |
| `cache` | Its fragment digest is keyed the same way |
| A partial declaring strict locals | Rails is the only one who can enforce them; the copy has no signature to check against |
| A partial in another format | Resolved in the template's own format instead, since the shared candidate order puts HTML first |
| A partial that does not parse | So the error is still reported against the partial |
| `<% render %>` that does not output | Rails throws its value away, so the markup was never asked for |

It has to run first, and the engine refuses a stack that puts it anywhere else. Everything after it sees the partial's markup as part of the template it landed in, which is what holds a partial to whatever the template around it is held to. A validator that refuses markup in a template refuses it in a partial, and a transform that rewrites a tag rewrites it wherever it was written. Were it to run last, moving markup into a partial would be a way of turning those off.

A partial that is inlined never renders, so nothing about it would reach the session either. What was moved is recorded on `Herb::Engine::Origin`, and `Visitors::Instrumentation` reads it, so the page describes itself the same way whether the partial was inlined or rendered:

```ruby
Herb::Engine.new(source, visitors: [
  Herb::Engine::Visitors::InlineRender.new,
  Herb::Engine::Visitors::Instrumentation.new
])
```

```json
{ "id": "2", "template": "app/views/posts/_card.html.erb", "parent": "1", "line": 1, "column": 6, "via": "partial" }
```

A query issued inside an inlined partial is filed under the partial, not under the template it landed in, and a collection reports one render per item rather than one for all of them. The lines and columns need no adjusting, because the nodes came from the partial's own source.

### `ScopedStyle::Visitor` <Badge type="warning" text="experimental" />

`ScopedStyle::Visitor` scopes a `<style scoped>` block to the markup written in the same file, similar to how Vue and Svelte scope a component's styles. It marks the file's elements with a scope attribute derived from its path, and narrows the block's selectors to require it, so the block styles those elements and nothing else.

It transforms this:

```html
<style scoped>
  .title { color: red; }
</style>

<h1 class="title">Hi</h1>
```

into this:

```html
<style>
  .title:where([data-herb-scope-1a2b3c4d], [data-herb-scope-1a2b3c4d] *) {
    color: red;
  }
</style>

<h1 class="title" data-herb-scope-1a2b3c4d>Hi</h1>
```

Here the scope sits on the root alone. `:where([data-herb-scope-1a2b3c4d], [data-herb-scope-1a2b3c4d] *)` matches the root and everything inside it, so nested elements need no attribute of their own. A file that renders a partial is scoped differently. Every element the file wrote carries the scope, and the selector narrows to `[data-herb-scope-1a2b3c4d]` alone, so the scope stays on that markup and never reaches into the partial.

The visitor does not rewrite the CSS itself. It passes the CSS to a `transform`, and the [`lightningcss`](https://github.com/marcoroth/lightningcss-ruby) gem is one. Give the visitor a `LightningCSS::Transformer`, and each rule in the block is narrowed to the scope.

```ruby
require "herb/engine/scoped_style/visitor"
require "lightningcss"

Herb::Engine.new(source, filename: path, visitors: [
  Herb::Engine::ScopedStyle::Visitor.new(transform: LightningCSS::Transformer.new)
])
```

The `herb compile --scoped-styles` and `herb render --scoped-styles` commands wire the same thing up from the command line, installing `lightningcss` the first time if it is not already there.

Given no `transform`, the block is left as it was written and a diagnostic reports it, because scoping the markup while leaving the CSS untouched would turn a scoped block into a global one. The same holds for a block built with ERB, which has no CSS to read at compile time, and for a template compiled without a `filename`, which has no stable scope to derive. A `transform` that raises is treated the same way, so CSS nobody can read costs the block it was written in and not the whole template.

`deliver` says where the narrowed CSS goes.

| Value     | Description                                                                             |
|-----------|-----------------------------------------------------------------------------------------|
| `:inline` | Leaves the block where it was written. This is the default. It needs nothing else installed, and writes the block again on every render of the file. |
| `:hoist`  | Takes the block out and registers the CSS on a [channel](#delivering-something-other-than-diagnostics) of the session the page is collecting into, so it is written once however many times the file renders. Needs `Herb::Engine::Report::Middleware` to put it on the page. |
| `:none`   | Takes the block out and puts nothing in its place, for when the CSS was already gathered into an asset. The markup still carries its scope attribute. |

It is set alongside `transform`:

```ruby
Herb::Engine::ScopedStyle::Visitor.new(transform: transform, deliver: :hoist)
```

#### Supplying your own transform

Lightning CSS is one way to narrow the CSS, and not the only one. `transform` is any object that answers `call`. The visitor hands it the block's CSS and the scope, and reads a narrowed stylesheet back, so a different CSS engine or a hand-written rewriter fits the same slot.

| Argument       | Type     | Description                                              |
|----------------|----------|----------------------------------------------------------|
| `css`          | `String` | The block's CSS, exactly as it was written               |
| `scope:`       | `String` | A selector fragment every rule has to be narrowed by     |
| *return value* | any      | Anything whose `to_s` is the narrowed CSS                |

```ruby
transform.call(".title { color: red }", scope: "[data-herb-scope-1a2b3c4d]")
#=> ".title[data-herb-scope-1a2b3c4d] { color: red }"
```

A return value answering `warnings` has each of them reported as a diagnostic, which is how a `LightningCSS::Result` surfaces what Lightning CSS kept without acting on. CSS a transform could not act on is CSS that does nothing once the page renders, so it is worth saying so at compile time. A transform answering with a plain string reports nothing.

#### Gathering the CSS ahead of time

A scope and its CSS are decided when a file is compiled, so everything a stylesheet needs is knowable before anything renders. `ScopedStyle::Collector` compiles a set of files for that and nothing else:

```ruby
require "herb/engine/scoped_style/collector"

collector = Herb::Engine::ScopedStyle::Collector.new(transform: transform, project_path: root)

collector.add("app/views/posts/_card.html.erb")
collector.add("app/views/posts/index.html.erb")

collector.to_css   #=> the one stylesheet those files add up to
collector.styles   #=> { "data-herb-scope-1a2b3c4d" => "..." }
collector.files    #=> which scopes each file contributed
collector.failures #=> the files it could not compile, and why
```

Paths are expanded before they are compiled, so the scopes it gathers are the ones the same files carry when your application compiles them. A file it cannot compile is recorded in `failures` and skipped, so one broken template does not take a build down.

Templates then compile with `deliver: :none` and emit no CSS at all, because the stylesheet already has it.

Which files to gather, where the stylesheet goes, and how it reaches the page is the job of whatever integrates Herb with a framework.

It has to run after `Visitors::InlineRender`, so that markup an inlined partial brought with it takes the partial's own scope, and before `Slots::Visitor`, because the markup `Slots::Visitor` parks for a client to rebuild has to carry the attribute already.

## Diagnostics

Anything the engine or a visitor finds is a `Herb::Diagnostic`, whoever found it and whenever they found it. One value object means a parse error, a security violation, and a measurement taken while the page rendered all reach the browser through the same channel, so a new checker gets delivery without inventing one.

```ruby
Herb::Diagnostic.new(
  template: "app/views/posts/index.html.erb",
  message: "This element is suspicious.",
  code: "suspicious-element",
  origin: "Herb Compiler",
  severity: :warning,
  location: node.location
)
```

`origin` says who found it and is what a consumer groups by. `severity` is one of `:error`, `:warning`, `:info`, or `:hint`. `kind` is `:diagnostic` by default, or `:metric` for a measurement, which carries a `value` badge instead of a severity.

Positions are Herb-native, counting lines from one and columns from zero, the same as everywhere else in Herb. The payload counts columns from one, and that shift happens in exactly one place, so a diagnostic built straight from a node needs no adjusting.

### Reporting from a visitor

Any visitor can report by including `Herb::Engine::Diagnostics`. It is a mixin rather than a base class, so a visitor that rewrites the tree can report as well:

```ruby
class SuspiciousElementVisitor < Herb::Visitor
  include Herb::Engine::ContextAware
  include Herb::Engine::Diagnostics

  def visit_html_element_node(node)
    warning("This element is suspicious.", node.location, code: "suspicious-element")

    super
  end
end
```

`error`, `warning`, `info`, and `hint` each record and keep walking. The engine collects from every visitor that responds to `diagnostics` once the visitors have run, so reporting needs no wiring beyond including the mixin. `ContextAware` is what fills in the template name, because the engine hands every context-aware visitor its `VisitorContext`.

Findings recorded this way are compiled into the template, so they reach the browser when it renders rather than being spliced into the HTML at compile time.

### Delivering them to the browser

A `Herb::Engine::Report::Session` is where everything found while one page renders collects, so findings from separate producers end up in one payload rather than one channel each. `Herb::Engine::Report::Middleware` scopes one to each request and injects the result:

```ruby
require "herb/engine/report/middleware"

config.middleware.use Herb::Engine::Report::Middleware
```

It writes a single `data-herb-diagnostics` script before `</body>`. A response it cannot safely touch is returned untouched, and any error while injecting is swallowed in favour of the original response, so nothing here can be the reason a page fails.

The session it used is left in the Rack env, which is how a test reads what a request collected:

```ruby
get "/posts"

request.env[Herb::Engine::Report::Middleware::ENV_KEY].diagnostics
```

Wrapping a request works too. A session that is already open is one somebody means to read, so the middleware collects into that one rather than opening its own:

```ruby
session = Herb::Engine::Report::Session.capture { get "/posts" }
```

### Delivering something other than diagnostics

Diagnostics are not the only thing a page collects. A `Herb::Engine::Report` also keeps **channels**, which is where a producer other than the compiler puts what it found, and it knows nothing about what any of them hold.

A channel is anything answering three methods:

| Method     | Returns  | Description                                                        |
|------------|----------|--------------------------------------------------------------------|
| `empty?`   | `bool`   | Whether it collected anything. An empty channel is never written.  |
| `to_html`  | `String` | The markup to put on the page.                                     |
| `anchor`   | `Symbol` | `:head` or `:body`, the tag it wants to be written before.         |

The block builds one the first time its name is asked for, so a producer registers itself as it records and nothing has to be wired up in advance:

```ruby
Herb::Engine::Report::Session.current.channel(:query_log) { QueryLog.new }.add(sql)
```

A channel that collects queries and writes them at the end of the body looks like this:

```ruby
class QueryLog
  def initialize = @queries = []
  def add(sql) = @queries << sql

  def anchor = :body
  def empty? = @queries.empty?
  def to_html = %(<script type="application/json" data-query-log>#{JSON.generate(@queries)}</script>)
end
```

The middleware writes every non-empty channel before the tag it asked for, and a channel asking for a tag the response does not have is left alone. Adding a producer needs nothing in `Report`, `Session`, or `Middleware`.

## Instrumentation <Badge type="warning" text="experimental" />

`Visitors::Instrumentation` frames every ERB tag with a call saying which tag is rendering, so whatever happens while it renders can be attributed to it rather than to the template as a whole.

It supplies where, and something else has to supply what. A template compiled with it and rendered with nothing watching records nothing at all, and only costs a call per tag. What makes it worth having is anything that calls `Herb::Engine::Report::Session.observe` while a tag is rendering:

```ruby
require "herb/engine/visitors/instrumentation"

engine = Herb::Engine.new(source, visitors: [Herb::Engine::Visitors::Instrumentation.new])

ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
  Herb::Engine::Report::Session.observe(:queries, payload[:sql]) unless payload[:cached]
end
```

Nothing about that subscription belongs to Herb, which is the point. Because what gets watched is decided at render time rather than compiled in, watching something new never means recompiling a template.

`Session#measure` turns what was observed into one diagnostic per tag that saw any:

```ruby
session.measure(:queries, origin: "Herb Engine", code: "sql-queries") do |queries|
  "#{queries.size} SQL queries"
end
#=> app/views/posts/_card.html.erb:7:9: [sql-queries] 3 SQL queries
```

A count is a measurement rather than a fault, so what comes out carries a badge and no severity. Three queries at one tag is worth showing every time and worth worrying about only sometimes, and which of those it is depends on what the tag is for.

### The render stack

A tag that renders a partial stays open while that partial renders, so `Session.stack` is a render stack across every instrumented template and not only within one. It reads innermost first, the way `caller` does:

```ruby
Herb::Engine::Report::Session.stack
#=> [["app/views/posts/_card.html.erb", 2, 2],
#    ["app/views/posts/index.html.erb", 4, 4],
#    ["app/views/layouts/application.html.erb", 2, 2]]
```

Each frame is `[template, line, column]`, with the column counted from zero as everywhere else in the AST. A template compiled without the visitor contributes no frames, so an uninstrumented partial part-way down a chain is skipped rather than showing as a gap.

An observation is only filed under the innermost frame, so anything wanting the rest has to take it while it still exists, which is one line in the subscriber:

```ruby
Herb::Engine::Report::Session.observe(:queries, { sql: sql, stack: Herb::Engine::Report::Session.stack })
```

### The render tree

Every template the visitor compiled reports one render when it starts, and those become the payload's `renderTree`. A node is one *occurrence*, so a partial rendered twice is two nodes rather than one entry counted twice:

```json
[
  { "id": "1", "template": "app/views/layouts/application.html.erb" },
  { "id": "2", "template": "app/views/posts/index.html.erb", "parent": "1", "line": 2, "column": 3, "via": "partial" },
  { "id": "3", "template": "app/views/posts/_card.html.erb", "parent": "2", "line": 2, "column": 3, "via": "collection" },
  { "id": "4", "template": "app/views/posts/_card.html.erb", "parent": "2", "line": 2, "column": 3, "via": "collection" }
]
```

`parent` is the render this one happened inside, and `line` and `column` are where in that parent it was called from, counted the way the rest of the payload counts. Walking `parent` from any node gives the whole chain that reached it, which is the same information `Session.stack` reports live, except that the tree keeps the occurrences apart. Two renders of one partial produce identical stacks and different nodes.

`via` says what kind of render reached the template:

| `via`        | Written as                                          |
|--------------|-----------------------------------------------------|
| `partial`    | `<%= render "posts/card" %>`                        |
| `collection` | `<%= render partial: "card", collection: @posts %>` |
| `layout`     | `<%= render layout: "box" do %>`                    |
| `template`   | `<%= render template: "posts/show" %>`              |

It comes from the tag that did the rendering, because the template being rendered has no idea how it was reached. `<%= render @post %>` is left without a `via` on purpose, since Rails decides whether that is one partial or a collection by asking the object at render time, and there is no honest answer for it at compile time.

Reading `via` needs the `render_nodes` [parser option](/parser-options), which the visitor recommends and the engine therefore turns on. Passing `render_nodes: false` explicitly still works and only costs the `via` field.

### Annotating a render

Some things are facts about a render rather than faults in it. A render time exists for every template rather than the rare broken one, and belongs beside what it describes rather than in a list of things to fix. Sending those through `record` would spend the diagnostics budget on the ordinary case, so they go to `annotate` instead:

```ruby
Herb::Engine::Report::Session.annotate(:render_time, 1.5, origin: "reactionview")
```

They collect into the payload's `nodes`, keyed by the render they were made during:

```json
{
  "3": { "reactionview": { "render_time": 1.5 } },
  "4": { "reactionview": { "render_time": 1.5 } }
}
```

Each producer gets its own namespace under `origin`, so two of them can annotate one render without knowing about each other or agreeing on key names. Herb never reads the keys, so what they are called is up to whoever writes them, with snake_case being the convention the rest of the payload follows.

An annotation made outside any render is dropped rather than given a node of its own. `Session.current_node` reports which render is open, and `nil` when none is.

Instrumentation is experimental as it instruments every ERB tag.

## ReActionView Integration

[ReActionView](https://github.com/marcoroth/reactionview) registers `Herb::Engine` as the template handler for `.html.erb` and `.html.herb` files in Rails. It runs the validators with `fatal: false` in development, so problems reach the browser instead of raising and the page still renders.

Validator settings from `.herb.yml` are respected automatically, with no ReActionView-specific configuration needed.

ReActionView also lets you run transform visitors on every template it compiles, through `config.transform_visitors`:

```ruby [config/initializers/reactionview.rb]
require "herb/engine/visitors/auto_close_omitted_tags"

ReActionView.configure do |config|
  config.transform_visitors = [
    Herb::Engine::Visitors::AutoCloseOmittedTags.new
  ]
end
```
