---
outline: deep
---

# Extracting Ruby and HTML

Extraction pulls one language out of a template and blanks out the other. It is how a tool that only understands Ruby, such as RuboCop or a Ruby parser, gets something it can read, and how an HTML tool gets markup without ERB in the middle of it.

## Extract the Ruby

::: code-group
```ruby [Ruby]
source = %(<p>Hello <%= user.name %></p>)

Herb.extract_ruby(source)
# => "             user.name  ;    "
```

```js [JavaScript]
const source = "<p>Hello <%= user.name %></p>"

Herb.extractRuby(source)
// => "             user.name  ;    "
```

```java [Java]
import org.herb.Herb;

String ruby = Herb.extractRuby("<p>Hello <%= user.name %></p>");
// "             user.name  ;    "
```

```rust [Rust]
use herb::extract_ruby;

let ruby = extract_ruby("<p>Hello <%= user.name %></p>").unwrap();
// "             user.name  ;    "
```
:::

By default every character keeps the position it had in the template, with the HTML replaced by spaces. A Ruby error on line 12 column 30 of the extracted output is on line 12 column 30 of the template, so positions need no translation.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `semicolons` | Boolean | `true` | Add ` ;` at the end of each ERB tag to separate statements |
| `comments` | Boolean | `false` | Include ERB comments (`<%# %>`) in the output |
| `preserve_positions` | Boolean | `true` | Maintain character positions by padding with whitespace |

::: code-group
```ruby [Ruby]
Herb.extract_ruby(source, semicolons: false)
```

```js [JavaScript]
Herb.extractRuby(source, { semicolons: false })
```

```java [Java]
import org.herb.ExtractRubyOptions;

ExtractRubyOptions options = ExtractRubyOptions.create().semicolons(false);

Herb.extractRuby(source, options);
```

```rust [Rust]
use herb::{extract_ruby_with_options, ExtractRubyOptions};

let options = ExtractRubyOptions { semicolons: false, ..Default::default() };

extract_ruby_with_options(source, &options).unwrap();
```
:::

What each option changes, shown in Ruby and the same everywhere:

```ruby
source = "<% x = 1 %> <% y = 2 %>"

Herb.extract_ruby(source)
# => "   x = 1  ;    y = 2  ;"

Herb.extract_ruby(source, semicolons: false)
# => "   x = 1       y = 2   "

Herb.extract_ruby("<%# comment %>\n<% code %>", comments: true)
# => "  # comment   \n   code  ;"

Herb.extract_ruby("<%# comment %><%= something %>", preserve_positions: false, comments: true)
# => "# comment \n something "
```

> [!TIP]
> Use `preserve_positions: false` when you want readable Ruby. Keep the default when you need positions in the output to match positions in the template.

## Extract the HTML

::: code-group
```ruby [Ruby]
Herb.extract_html(%(<p>Hello <%= user.name %></p>))
# => "<p>Hello                 </p>"
```

```js [JavaScript]
Herb.extractHTML("<p>Hello <%= user.name %></p>")
// => "<p>Hello                 </p>"
```

```java [Java]
String html = Herb.extractHTML("<p>Hello <%= user.name %></p>");
// "<p>Hello                 </p>"
```

```rust [Rust]
use herb::extract_html;

let html = extract_html("<p>Hello <%= user.name %></p>").unwrap();
// "<p>Hello                 </p>"
```
:::

The ERB is replaced by spaces, so the HTML keeps its positions the same way the Ruby does.

## Next

[Working with the tree](/bindings/tree) is the other way to get at one language, by walking the nodes instead of blanking out text.
