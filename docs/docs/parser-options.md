---
outline: deep
---

# Parser Options

Every Herb parse is driven by a set of parser options. They control how much work the parser does, which diagnostics it reports, and how much detail ends up in the resulting syntax tree.

The options are defined once in the C library (`parser_options_T`) and surfaced through every binding, so the same option names and defaults apply whether you are calling Herb from Ruby, JavaScript, or the CLI.

## Passing Options

Options are passed alongside the source when you parse:

:::code-group
```ruby [Ruby]
Herb.parse("<div>Hello</div>", strict: false, track_whitespace: true)
```

```js [JavaScript]
Herb.parse("<div>Hello</div>", { strict: false, track_whitespace: true })
```

```bash [CLI]
herb parse index.html.erb --no-strict --track-whitespace
```
:::

Any option you leave out falls back to its default. `Herb.parse_file`/`Herb.parseFile` accept the same options.

## Available Options

| Option                                  | Type      | Default                                   | Description                                                                                            |
|-----------------------------------------|-----------|-------------------------------------------|--------------------------------------------------------------------------------------------------------|
| [`strict`](#strict)                     | `Boolean` | `true`                                    | Report diagnostics for patterns that are valid HTML+ERB but ambiguous for tooling                      |
| [`analyze`](#analyze)                   | `Boolean` | `true`                                    | Run the post-parse analysis passes (ERB control-flow structure, HTML tag matching, Ruby syntax errors) |
| [`track_whitespace`](#track-whitespace) | `Boolean` | `false`                                   | Keep insignificant whitespace in the syntax tree as `WhitespaceNode`s                                  |
| `html`                                  | `Boolean` | `true`                                    | Parse HTML tags. When `false`, HTML-like content is treated as literal text                            |
| `action_view_helpers`                   | `Boolean` | `false`                                   | Detect Action View tag helpers (`tag`, `content_tag`, `link_to`, …) and parse their block bodies       |
| `transform_conditionals`                | `Boolean` | `false`                                   | Transform postfix conditionals and ternaries in ERB content                                            |
| `render_nodes`                          | `Boolean` | `false`                                   | Detect Action View `render` calls and represent them as dedicated nodes                                |
| `strict_locals`                         | `Boolean` | `false`                                   | Analyze `<%# locals: (…) %>` strict locals magic comments                                              |
| `iteration_nodes`                       | `Boolean` | `false`                                   | Represent iteration blocks (`each`, `map`, …) as dedicated nodes                                       |
| `dot_notation_tags`                     | `Boolean` | `false`                                   | Parse dot-notation component tags (like `<Dialog.Button>`) as HTML elements                            |
| `prism_nodes`                           | `Boolean` | `false`                                   | Attach the Prism node for each ERB tag's Ruby code                                                     |
| `prism_nodes_deep`                      | `Boolean` | `false`                                   | Attach Prism nodes including their full subtrees                                                       |
| `prism_program`                         | `Boolean` | `false`                                   | Attach the full Prism `ProgramNode` to the `DocumentNode`                                              |
| `timeout`                               | `Number`  | `1` second (Ruby), `1000` ms (JavaScript) | Abort the parse after this duration. `0` disables the timeout                                          |
| `max_errors`                            | `Integer` | `25`                                      | Stop collecting errors after this many. `nil`/`null` means unlimited                                   |


> [!NOTE]
> `timeout` is expressed in **seconds** in the Ruby bindings and in **milliseconds** in the JavaScript bindings. Both map onto the same underlying `timeout_ms` field.

The rest of this page covers `strict`, `analyze`, and `track_whitespace` in detail, since those three have the largest effect on what you get back from a parse.

## `strict` <Badge type="tip" text="^0.9.0" />

**Type:** `Boolean` **Default:** `true`

Strict mode is purely diagnostic. It never changes the shape of the syntax tree, it only decides whether Herb reports a handful of additional errors for constructs that are technically allowed but ambiguous for tooling.

With `strict: true`, the parser additionally reports:

- **`OmittedClosingTagError`** for elements whose closing tag was omitted (`<li>`, `<p>`, `<td>`, and friends). The element is still built with an `HTMLOmittedCloseTagNode` either way, strict mode just adds the diagnostic.
- **`StrayERBClosingTagError`** for a `%>` that is not part of an ERB tag and will therefore be rendered as plain text.
- **`ERBCaseWithConditionsError`** for a `case` statement that carries its `when`/`in` conditions inside a single ERB tag, which cannot be reliably compiled or formatted.

```erb
<ul>
  <li>Item 1
  <li>Item 2
</ul>
```

With the default `strict: true`, this reports two `OmittedClosingTagError`s:

```
Element `<li>` at (2:2) has its closing tag omitted. While valid HTML, consider
adding an explicit `</li>` closing tag at (3:2) for clarity, or set `strict: false`
to allow this.
```

With `strict: false` the same template parses to the exact same AST, without the errors.

:::code-group
```ruby [Ruby]
Herb.parse(source, strict: false).errors
# => []
```

```js [JavaScript]
Herb.parse(source, { strict: false }).errors
// => []
```

```bash [CLI]
herb parse index.html.erb --no-strict
```
:::

> [!TIP]
> Keep `strict: true` for linting, formatting, and CI. Reach for `strict: false` when you are parsing templates you do not control and only care about the tree, not the diagnostics.

## `analyze`

**Type:** `Boolean` **Default:** `true`

Analysis is the post-parse pipeline that turns the parser's flat output into the structured tree most consumers expect. It is responsible for:

- Running Prism over each ERB tag's Ruby code, populating `parsed`, `valid`, and `analyzed_ruby`
- Transforming flat `ERBContentNode`s into structured control-flow nodes (`ERBIfNode`, `ERBBlockNode`, `ERBCaseNode`, `ERBEndNode`, …)
- Matching HTML open and close tags into `HTMLElementNode`s
- Reporting Ruby syntax errors found in ERB tags
- Running the optional transforms enabled by `render_nodes`, `iteration_nodes`, `strict_locals`, `action_view_helpers`, and `transform_conditionals`

With the default `analyze: true`, ERB control flow is structured:

```erb
<% if true %>
<% end %>
```

```
@ DocumentNode (location: (1:0)-(3:0))
└── children: (2 items)
    ├── @ ERBIfNode (location: (1:0)-(2:9))
    │   ├── tag_opening: "<%" (location: (1:0)-(1:2))
    │   ├── content: " if true " (location: (1:2)-(1:11))
    │   ├── tag_closing: "%>" (location: (1:11)-(1:13))
    │   ├── then_keyword: ∅
    │   ├── statements: (1 item)
    │   │   └── @ HTMLTextNode (location: (1:13)-(2:0))
    │   │       └── content: "\n"
    │   │
    │   ├── subsequent: ∅
    │   └── end_node:
    │       └── @ ERBEndNode (location: (2:0)-(2:9))
    │           ├── tag_opening: "<%" (location: (2:0)-(2:2))
    │           ├── content: " end " (location: (2:2)-(2:7))
    │           └── tag_closing: "%>" (location: (2:7)-(2:9))
    │
    │
    └── @ HTMLTextNode (location: (2:9)-(3:0))
        └── content: "\n"
```

With `analyze: false`, the same source yields a flat tree of `ERBContentNode`s with no relationship between the `if` and its `end`:

```
@ DocumentNode (location: (1:0)-(3:0))
└── children: (4 items)
    ├── @ ERBContentNode (location: (1:0)-(1:13))
    │   ├── tag_opening: "<%" (location: (1:0)-(1:2))
    │   ├── content: " if true " (location: (1:2)-(1:11))
    │   ├── tag_closing: "%>" (location: (1:11)-(1:13))
    │   ├── parsed: false
    │   └── valid: false
    │
    ├── @ HTMLTextNode (location: (1:13)-(2:0))
    │   └── content: "\n"
    │
    ├── @ ERBContentNode (location: (2:0)-(2:9))
    │   ├── tag_opening: "<%" (location: (2:0)-(2:2))
    │   ├── content: " end " (location: (2:2)-(2:7))
    │   ├── tag_closing: "%>" (location: (2:7)-(2:9))
    │   ├── parsed: false
    │   └── valid: false
    │
    └── @ HTMLTextNode (location: (2:9)-(3:0))
        └── content: "\n"
```

> [!WARNING]
> HTML open/close tag matching also happens during analysis. With `analyze: false` you get `HTMLOpenTagNode` and `HTMLCloseTagNode` as siblings instead of nested `HTMLElementNode`s, and no Ruby syntax errors are reported. Most tooling built on Herb (the linter, formatter, and language server) requires `analyze: true`.

:::code-group
```ruby [Ruby]
Herb.parse(source, analyze: false)
```

```js [JavaScript]
Herb.parse(source, { analyze: false })
```

```bash [CLI]
herb parse index.html.erb --no-analyze
```
:::

> [!TIP]
> Use `analyze: false` when you only need raw token-shaped structure and want to skip the cost of the analysis passes, for example when scanning a large number of files for something purely lexical.

## `track_whitespace`

**Type:** `Boolean` **Default:** `false`

By default the parser discards insignificant whitespace: the run of spaces between a tag name and its attributes, between two attributes, or around the `=` in an attribute. That whitespace does not affect rendering, so it is dropped to keep the tree small.

With `track_whitespace: true`, that whitespace is preserved instead:

- Each run of whitespace or newlines becomes a `WhitespaceNode` in the surrounding `children` collection
- Whitespace surrounding an attribute's `=` is folded into the `equals` token, so the token's value and location span the whitespace as well

This makes the tree **lossless**, which is what you need to reproduce the original source byte-for-byte.

Given this source:

```html
<div     class="hello">content</div>
```

The default parse collapses the run of spaces, and the open tag has a single child:

```
├── @ HTMLOpenTagNode (location: (1:0)-(1:23))
│   ├── tag_opening: "<" (location: (1:0)-(1:1))
│   ├── tag_name: "div" (location: (1:1)-(1:4))
│   ├── tag_closing: ">" (location: (1:22)-(1:23))
│   ├── children: (1 item)
│   │   └── @ HTMLAttributeNode (location: (1:9)-(1:22))
│   │       └── [...]
│   └── is_void: false
```

With `track_whitespace: true`, the whitespace shows up as its own node:

```
├── @ HTMLOpenTagNode (location: (1:0)-(1:23))
│   ├── tag_opening: "<" (location: (1:0)-(1:1))
│   ├── tag_name: "div" (location: (1:1)-(1:4))
│   ├── tag_closing: ">" (location: (1:22)-(1:23))
│   ├── children: (2 items)
│   │   ├── @ WhitespaceNode (location: (1:4)-(1:9))
│   │   │   └── value: "     " (location: (1:4)-(1:9))
│   │   │
│   │   └── @ HTMLAttributeNode (location: (1:9)-(1:22))
│   │       └── [...]
│   └── is_void: false
```

:::code-group
```ruby [Ruby]
Herb.parse(source, track_whitespace: true)
```

```js [JavaScript]
Herb.parse(source, { track_whitespace: true })
```

```bash [CLI]
herb parse index.html.erb --track-whitespace
```
:::

> [!TIP]
> Enable `track_whitespace` whenever you intend to print, rewrite, or format a template and need the output to match the input exactly. Herb's own printer, formatter, rewriter, and linter all opt into it. Leave it off when you are only inspecting or analyzing the tree, since the extra nodes are noise you would have to skip over.

## Inspecting the Options Used for a Parse

Every parse result carries back the options that produced it, which is useful when the options came from a config file or a tool you do not control:

:::code-group
```ruby [Ruby]
result = Herb.parse("<div>Hello</div>")

result.options.strict            # => true
result.options.track_whitespace  # => false
result.options.analyze           # => true

result.options.to_h
# => { strict: true, track_whitespace: false, analyze: true, ... }
```

```js [JavaScript]
const result = Herb.parse("<div>Hello</div>")

result.options.strict            // => true
result.options.track_whitespace  // => false
result.options.analyze           // => true
```
:::

## Trying Options Out

The [Herb Playground](/playground/) exposes `strict`, `analyze`, and `track_whitespace` as checkboxes, so you can see how each one changes the syntax tree for a given template without writing any code.
