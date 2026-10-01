---
outline: deep
---

# Lexing

Lexing turns HTML+ERB into a flat list of tokens, without building a tree. It is what you want when you need the raw pieces of a template, such as highlighting source or counting tags, and do not care how they nest. Most work wants [parsing](/bindings/parsing) instead.

## Lex a string

::: code-group
```ruby [Ruby]
source = %(<p>Hello <%= user.name %></p>)

Herb.lex(source).value
```

```js [JavaScript]
const source = "<p>Hello <%= user.name %></p>"

Herb.lex(source).value
```

```java [Java]
import org.herb.Herb;
import org.herb.LexResult;
import org.herb.Token;

LexResult result = Herb.lex("<p>Hello <%= user.name %></p>");

for (Token token : result.tokens) {
  System.out.println(token.inspect());
}
```

```rust [Rust]
use herb::lex;

let result = lex("<p>Hello <%= user.name %></p>").unwrap();

for token in result.tokens() {
  // do something with each token
}
```
:::

Every binding produces the same tokens.

```
#<Herb::Token type="TOKEN_HTML_TAG_START" value="<" range=[0, 1] start=(1:0) end=(1:1)>
#<Herb::Token type="TOKEN_IDENTIFIER" value="p" range=[1, 2] start=(1:1) end=(1:2)>
#<Herb::Token type="TOKEN_HTML_TAG_END" value=">" range=[2, 3] start=(1:2) end=(1:3)>
...
#<Herb::Token type="TOKEN_EOF" value="" range=[29, 29] start=(1:29) end=(1:29)>
```

A token carries its type, its value, the range of bytes it covers and the location it was found at. [Tokens](/c-reference/tokens) lists every type.

## Lex a file

Ruby and JavaScript read the file for you.

::: code-group
```ruby [Ruby]
Herb.lex_file("./index.html.erb").value
```

```js [JavaScript]
Herb.lexFile("./index.html.erb").value
```
:::

In Java and Rust, read the file yourself and pass the string to `lex`. `lexFile` throws in the `@herb-tools/browser` package, which has no file access.

## Next

[Parsing](/bindings/parsing) builds a tree from the same source, which is what the linter, the formatter and the engine all work on.
