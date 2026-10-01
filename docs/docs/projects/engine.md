# `Herb::Engine` <Badge type="tip" text="v0.7.0+" />

`Herb::Engine` renders HTML+ERB templates. It compiles the same templates [`Erubi::Engine`](https://github.com/jeremyevans/erubi) does, into Ruby that renders the same output, and adds what reading the HTML makes possible. A malformed template fails to compile with a line and a column, each `<%= %>` is escaped for where it sits, and validators check security, nesting and accessibility before the page renders.

In a Rails app you do not call the engine yourself. With the Rails 8.2 framework defaults, Rails compiles HTML templates through Herb, and on earlier versions [ReActionView](https://reactionview.dev) registers the engine as the template handler. [Templates](/language/templates) describes what it accepts and rejects.

This page is for using the engine directly, in a framework other than Rails or in your own integration. From [Transform Visitors](#transform-visitors) on, it covers extending the engine, which is only needed when building on Herb.

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

| Option | Purpose |
| --- | --- |
| `bufvar` / `outvar` | Buffer variable name |
| `bufval` | Initial buffer value |
| `escape` / `escape_html` | Whether `<%= %>` escapes by default |
| `escapefunc` | Escape function name |
| `filename` | Template filename |
| `freeze` | Add frozen string literal comment |
| `freeze_template_literals` | Freeze template string literals |
| `preamble` / `postamble` | Custom preamble/postamble |
| `chain_appends` | Chain `<<` calls for performance |
| `ensure` | Wrap in begin/ensure block |
| `src` | Initial source string |
| `trim` | Fold the whitespace around standalone `<% %>` and `<%# %>` tags into the code (default `true`) |
| `literal_prefix` | Opening delimiter an escaped tag compiles to (default `<%`) |
| `literal_postfix` | Closing delimiter an escaped tag compiles to (default `%>`) |

### Whitespace trimming

`trim` is on by default, the same as in Erubi. A `<% %>` or `<%# %>` tag that stands alone on its line folds the indentation in front of it and the newline after it into the code line, so neither reaches the output. `-%>` on a `<%= %>` tag drops the newline after it wherever the tag sits. `<%-` is accepted and leaves the whitespace in front of the tag alone, which is what Erubi does with it too. Trimming is what makes a `case` written across several tags compile under Erubi:

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

The newline after `<% case status %>` is trimmed, so nothing lands between `case` and its first `when`, and the compiled Ruby is valid. Herb and Erubi emit byte-identical output here.

Pass `trim: false` to keep every byte of whitespace around code and comment tags, which is what a plain-text template usually wants. Herb renders the same output as Erubi with the option off, including the newline that `-%>` still drops after an expression. The `case` template above is the one place the two part ways under `trim: false`. Erubi appends the newline between `case` and `when` to the buffer and produces invalid Ruby. Herb does not emit the whitespace between a `case` tag and its first `when`, so the template keeps compiling.

### Known differences from Erubi

One thing that `Erubi::Engine` accepts is handled differently by `Herb::Engine` on its default settings, and it is deliberate.

A `case` with its first `when` or `in` in the same ERB tag raises `ERBCaseWithConditionsError` under [strict parsing](/parser-options). Without strict mode it compiles like any other `case`, because the parser splits the tag so the `case` and the condition each own the Ruby they introduce, which leaves the `case` without a `%>` and the condition without a `<%`. A `case` and its first `in` pattern on the same line raises `ERBCaseInlinePatternMatchError` in both modes, because Ruby reads that as a one-line pattern match and no split makes it compile. The [`erb-no-inline-case-conditions`](/linter/rules/erb-no-inline-case-conditions.md) rule reports the style separately.

Two differences change what a template renders. The first is escaping. Erubi calls `to_s` on every `<%= %>` wherever it sits, because it never looks at the markup around the tag. Herb parses the HTML, so it knows the tag's context and escapes for it:

```erb
<input name="<%= field_name %>">
```

```ruby
_buf << ::Herb::Engine.attr((field_name));
```

Erubi compiles that same tag to `( field_name ).to_s`, so a value carrying `a" onload="alert(1)` escapes out of the attribute under Erubi and does not under Herb. A tag inside `<script>` gets `::Herb::Engine.js` and one inside `<style>` gets `::Herb::Engine.css` for the same reason. The three come from the `attrfunc`, `jsfunc`, and `cssfunc` options, which take the same shape as Erubi's `escapefunc`.

The second is a `<% %>` tag holding nothing but a Ruby comment. Herb drops the comment, so `a<% # c %>b` renders `ab`. Erubi emits it into the compiled Ruby, where it comments out the append that follows it on the same line, and the same template renders `a`. An `<%# %>` comment tag is unaffected and compiles the same under both.

The rest are formatting differences in output that renders identically. Herb writes `(title)` where Erubi writes `( title )`, escapes through `::Herb::Engine` instead of `::Erubi` and leaves that constant out when no tag in the template escapes, folds the text on both sides of an ERB comment into one literal where Erubi leaves an empty statement and a second append in its place, and inserts the `;` after a `preamble` that does not end in one, which Erubi leaves as a syntax error. Each of those is a test in the divergence suite.

An ERB delimiter written inside Ruby is read as Ruby by both engines, which they arrive at from opposite ends. Erubi's scanner never looks at the Ruby and takes everything up to the first `%>`, while Herb asks whether the text up to a `%>` parses as Ruby before it decides that a `<%` it passed was a nested tag. Strings, heredocs, `%q{}` and Ruby comments land on the same answer either way, so `<% label = "<%" %><%= label %>` renders `<%` under both.

Text that is not Ruby is where they part. `<%= name <%= other %>` reports `NestedERBTagError` under Herb, where Erubi compiles `_buf << ( name <%= other ).to_s` and leaves the syntax error to Ruby. A closing `%>` inside a string is unsupported by both, and `<%= "%>" %>` reports `StrayERBClosingTagError` under Herb where Erubi again emits Ruby that does not parse. A template that has to write a delimiter can build it out of pieces, `"%" + ">"`, or use the HTML entities `&percnt;&gt;` when it goes straight to the output.

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

### Templates that are not HTML

The parser's [`html`](/parser-options) option turns HTML parsing off, so `<` followed by a letter is plain text and only the ERB tags are structured. That is the mode for mail text, YAML, JavaScript, shell scripts, and anything else that is not markup, where the HTML parser would reject `a <b` or `<<EOF`:

```ruby
Herb::Engine.new(source, parser_options: { html: false })
```

The ERB structure is still parsed, so control flow, blocks, and trimming behave the same as in an HTML template. Context-aware escaping falls back to `escapefunc` for every `<%= %>`, since there is no attribute, script, or style context to tell apart. Nothing else about compilation changes.

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

### Escaped tags

`<%% %>` and `<%%= %>` are escaped ERB, and the engine compiles them to the literal text `<% %>` and `<%= %>`, the same as Erubi. Block tags are included, so `<%% form_with do %>` and its matching `<%% end %>` both reach the output as text.

Comments and control flow are included too, so `<%%# note %>` and `<%% if admin? %>` reach the output as text like any other escaped tag.

`literal_prefix` and `literal_postfix` choose the delimiters that escaped tags compile to. They default to `<%` and `%>`, which is what makes an escaped tag round-trip to ordinary ERB, and a template that generates something else can say so:

```ruby
Herb::Engine.new(%(<%%= item %>\n), literal_prefix: "{%", literal_postfix: "%}").src
# => _buf = ::String.new; _buf << '{%= item %}\n'.freeze;
# => _buf.to_s
```

Only the delimiters themselves are substituted. Everything the tag carries between them, including the `=` of an output tag and the `-` of a trimming one, is emitted verbatim, so `<%%- x -%>` becomes `{%- x -%}`.

A template that writes literal ERB is usually a generator template, one whose own output is an ERB file, and compiling it is rarely what a project sweep wants. That judgement lives in [`GeneratorTemplateValidator`](#validators) instead of in the engine, so `herb analyze` skips such a file while a caller that means to compile it simply leaves the validator out.

## Validators

Validators check a parsed template and report what they find. They are ordinary visitors, so nothing runs unless you pass it.

| Validator                | Description                                                                   |
|--------------------------|-------------------------------------------------------------------------------|
| `SecurityValidator`      | Detects ERB output in unsafe positions (attribute names, attribute positions) |
| `NestingValidator`       | Validates HTML nesting rules (e.g., no `<div>` inside `<p>`)                  |
| `AccessibilityValidator` | Validates accessibility-related attributes                                    |
| `RenderValidator`        | Validates `render` calls                                                      |
| `GeneratorTemplateValidator` | Reports a template that writes literal ERB through `<%% %>`               |

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

`Validators.all` returns a `Herb::Visitor::Stack`, an ordered list that also accepts anything else you want to run:

```ruby
stack = Herb::Engine::Validators.all
stack.use(MyVisitor.new)
stack.insert_after(Herb::Engine::Validators::SecurityValidator, MyOtherVisitor.new)
```

`use` appends, `insert` and `insert_after` place a visitor relative to another one by class, and `include_visitor?` asks whether one is already there. Naming a class that is not in the stack raises `Herb::Visitor::Stack::UnknownVisitorError` rather than putting it somewhere arbitrary.

## Transform Visitors

The `visitors` option accepts [visitors](/bindings/tree#visitors) that run over the AST before compilation. Transform visitors rewrite the AST, which changes what the compiler emits.

Herb ships the following transform visitors:

| Visitor                       | Description                                                                  |
|-------------------------------|------------------------------------------------------------------------------|
| `AutoCloseOmittedTagsVisitor` | Replaces omitted closing tags with explicit ones                             |
| `ComponentTags::Visitor`      | Rewrites capitalized tags into `render` calls (experimental)                 |
| `ContentForVisitor`           | Appends HTML to the end of every matching element                            |
| `CSSInliner::Visitor`         | Writes the CSS a template rendered into `style` attributes (experimental)    |
| `DebugVisitor`                | Annotates output with the template and position it came from                 |
| `HTMLSafeAssertionsVisitor`   | Checks every `.html_safe` call at runtime                                    |
| `InlineRender::Visitor`       | Replaces a `render` of a static partial with the partial (experimental)      |
| `InstrumentationVisitor`      | Frames every ERB tag so a render can be attributed to it (experimental)      |
| `OptimizeVisitor`             | Compile-time optimizations for helpers and literal output (experimental)     |
| `RemoveCommentsVisitor`       | Removes comments, so the output never contains one                           |
| `ScopedStyle::Visitor`        | Scopes a `<style scoped>` block to the file it was written in (experimental) |
| `Slots::Visitor`              | Marks every dynamic part so a client can update it in place (experimental)   |
| `SourceAttributionVisitor`    | Stamps every element with the template and position it was written at        |

Transform visitors are not loaded when you `require "herb"`. Require the ones you want and pass them to the engine:

```ruby
require "herb/engine/visitors/auto_close_omitted_tags_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::AutoCloseOmittedTagsVisitor.new])
```

Your own visitors are passed the same way. See [Visitors](/bindings/tree#visitors) for how to write one.

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

`reads_erb_source?` means it copies the template's own ERB somewhere, the way `DebugVisitor` puts it in `data-herb-debug-erb`. `rewrites_erb_source?` means it leaves ERB behind that the author did not write, the way `InstrumentationVisitor` wraps every tag. A visitor that answers neither is unconstrained and can run anywhere.

A third question, `inlines_renders?`, means the visitor brings markup from other files into the tree, the way `InlineRender::Visitor` does. One that answers it has to run first, so everything else sees what it brought in.

The engine checks this before it compiles anything, so a stack in the wrong order raises rather than producing a template that is quietly wrong:

```ruby
Herb::Engine.new(source, visitors: [
  Herb::Engine::InstrumentationVisitor.new,
  Herb::Engine::DebugVisitor.new
])
# => Herb::Visitor::Stack::OrderError
```

### Visitor context

A visitor that includes `Herb::Visitor::ContextAware` is handed a `Herb::Visitor::Context` before the engine walks the AST, so it doesn't have to be told things the engine already knows:

```ruby
class MyVisitor < Herb::Visitor
  include Herb::Visitor::ContextAware

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
```

and inside the visitor:
```ruby
context[:theme]              #=> "dark"
context.fetch(:missing, 1)   #=> 1
```

A context is immutable, and `#merge` returns a new one. Setting `context=` yourself always wins over the engine, which is what lets a visitor run standalone against any AST:

```ruby
visitor = MyVisitor.new
visitor.context = Herb::Visitor::Context.new(file_path: "app/views/users/show.html.erb")

Herb.parse(source).value.accept(visitor)
```

Each visitor has a page of its own.

| Visitor | Does |
| --- | --- |
| [`AutoCloseOmittedTagsVisitor`](/projects/engine/visitors/auto-close-omitted-tags) | Makes sure the compiled output always contains a closing tag, even when the template omits it. |
| [`RemoveCommentsVisitor`](/projects/engine/visitors/remove-comments) | Removes comments, so that the compiled output never contains one. |
| [`ContentForVisitor`](/projects/engine/visitors/content-for) | Appends HTML just before the closing tag of every element with a given name. |
| [`HTMLSafeAssertionsVisitor`](/projects/engine/visitors/html-safe-assertions) | Checks the value behind every `.html_safe` call, and raises when it carries markup the browser would execute. |
| [`ComponentTags::Visitor`](/projects/engine/visitors/component-tags) | Rewrites capitalized tags into `render` calls, so a component can be written as a tag instead of an ERB expression. |
| [`DebugVisitor`](/projects/engine/visitors/debug) | Annotates the rendered output with where it came from, so a rendered element can be traced back to the tag that produced it. |
| [`SourceAttributionVisitor`](/projects/engine/visitors/source-attribution) | Stamps every element with the template and the position it was written at, so a finding about the rendered page can be pointed back at the line that produced it. |
| [`OptimizeVisitor`](/projects/engine/visitors/optimize) *(experimental)* | Asks the parser to resolve Action View helpers into the markup they produce, so the compiler emits that markup instead of a call the renderer has to make. |
| [`InlineRender::Visitor`](/projects/engine/visitors/inline-render) *(experimental)* | Replaces a `render` of a static partial with the partial itself, so the rendered page costs no partial lookup at run time. |
| [`ScopedStyle::Visitor`](/projects/engine/visitors/scoped-style) *(experimental)* | Scopes a `<style scoped>` block to the markup written in the same file. |
| [`CSSInliner::Visitor`](/projects/engine/visitors/css-inliner) *(experimental)* | Moves a stylesheet into `style` attributes, which is what an email client reads. |

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

Any visitor can report by including `Herb::Visitor::Diagnostics`. It is a mixin rather than a base class, so a visitor that rewrites the tree can report as well:

```ruby
class SuspiciousElementVisitor < Herb::Visitor
  include Herb::Visitor::ContextAware
  include Herb::Visitor::Diagnostics

  def visit_html_element_node(node)
    warning("This element is suspicious.", node.location, code: "suspicious-element")

    super
  end
end
```

`error`, `warning`, `info`, and `hint` each record and keep walking. The engine collects from every visitor that responds to `diagnostics` once the visitors have run, so reporting needs no wiring beyond including the mixin. `ContextAware` is what fills in the template name, because the engine hands every context-aware visitor its `VisitorContext`.

Findings recorded this way are compiled into the template, so they reach the browser when it renders rather than being spliced into the HTML at compile time.

### Delivering them to the browser

A `Herb::Engine::Runtime::Session` is where everything found while one page renders collects, so findings from separate producers end up in one payload rather than one channel each. `Herb::Engine::Runtime::Middleware` scopes one to each request and injects the result:

```ruby
require "herb/engine/runtime/middleware"

config.middleware.use Herb::Engine::Runtime::Middleware
```

It writes a single `data-herb-diagnostics` script before `</body>`. A response it cannot safely touch is returned untouched, and any error while injecting is swallowed in favour of the original response, so nothing here can be the reason a page fails.

The session it used is left in the Rack env, which is how a test reads what a request collected:

```ruby
get "/posts"

request.env[Herb::Engine::Runtime::Middleware::ENV_KEY].diagnostics
```

Wrapping a request works too. A session that is already open is one somebody means to read, so the middleware collects into that one rather than opening its own:

```ruby
session = Herb::Engine::Runtime::Session.capture { get "/posts" }
```

### Delivering something other than diagnostics

Diagnostics are not the only thing a page collects. A `Herb::Engine::Runtime::Report` also keeps **channels**, which is where a producer other than the compiler puts what it found, and it knows nothing about what any of them hold.

A channel is anything answering three methods:

| Method     | Returns  | Description                                                        |
|------------|----------|--------------------------------------------------------------------|
| `empty?`   | `bool`   | Whether it collected anything. An empty channel is never written.  |
| `to_html`  | `String` | The markup to put on the page.                                     |
| `anchor`   | `Symbol` | `:head` or `:body`, the tag it wants to be written before.         |

The block builds one the first time its name is asked for, so a producer registers itself as it records and nothing has to be wired up in advance:

```ruby
Herb::Engine::Runtime::Session.current.channel(:query_log) { QueryLog.new }.add(sql)
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

`InstrumentationVisitor` frames every ERB tag with a call saying which tag is rendering, so whatever happens while it renders can be attributed to it rather than to the template as a whole.

It supplies where, and something else has to supply what. A template compiled with it and rendered with nothing watching records nothing at all, and only costs a call per tag. What makes it worth having is anything that calls `Herb::Engine::Runtime::Session.observe` while a tag is rendering:

```ruby
require "herb/engine/visitors/instrumentation_visitor"

engine = Herb::Engine.new(source, visitors: [Herb::Engine::InstrumentationVisitor.new])

ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
  Herb::Engine::Runtime::Session.observe(:queries, payload[:sql]) unless payload[:cached]
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
Herb::Engine::Runtime::Session.stack
#=> [["app/views/posts/_card.html.erb", 2, 2],
#    ["app/views/posts/index.html.erb", 4, 4],
#    ["app/views/layouts/application.html.erb", 2, 2]]
```

Each frame is `[template, line, column]`, with the column counted from zero as everywhere else in the AST. A template compiled without the visitor contributes no frames, so an uninstrumented partial part-way down a chain is skipped rather than showing as a gap.

An observation is only filed under the innermost frame, so anything wanting the rest has to take it while it still exists, which is one line in the subscriber:

```ruby
Herb::Engine::Runtime::Session.observe(:queries, { sql: sql, stack: Herb::Engine::Runtime::Session.stack })
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
Herb::Engine::Runtime::Session.annotate(:render_time, 1.5, origin: "reactionview")
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
require "herb/engine/visitors/auto_close_omitted_tags_visitor"

ReActionView.configure do |config|
  config.transform_visitors = [
    Herb::Engine::AutoCloseOmittedTagsVisitor.new
  ]
end
```
