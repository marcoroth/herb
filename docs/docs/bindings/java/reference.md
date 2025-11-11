---
outline: deep
---

# Java Reference

The `org.herb` package exposes classes for lexing, parsing, and extracting Ruby and HTML from HTML+ERB source code through JNI.

## Java API

The `Herb` class provides the following static methods:

* `Herb.lex(source)`
* `Herb.parse(source)`
* `Herb.parse(source, options)`
* `Herb.extractRuby(source)`
* `Herb.extractHTML(source)`
* `Herb.version()`
* `Herb.herbVersion()`
* `Herb.prismVersion()`

## Lexing

The `lex` method tokenizes an HTML document with embedded Ruby and returns a `LexResult` containing all tokens.

### `Herb.lex(String source)`

:::code-group
```java
import org.herb.Herb;
import org.herb.LexResult;
import org.herb.Token;

String source = "<p>Hello <%= user.name %></p>";
LexResult result = Herb.lex(source);

for (Token token : result.tokens) {
  System.out.println(token.inspect());
}
// Output:
// #<Herb::Token type="TOKEN_HTML_TAG_START" value="<" range=[0, 1] start=(1:0) end=(1:1)>
// #<Herb::Token type="TOKEN_IDENTIFIER" value="p" range=[1, 2] start=(1:1) end=(1:2)>
// #<Herb::Token type="TOKEN_HTML_TAG_END" value=">" range=[2, 3] start=(1:2) end=(1:3)>
// ...
```
:::

### `LexResult`

The `LexResult` class provides access to the lexed tokens:

```java
public class LexResult {
  public List<Token> tokens;
  public String source;
  public int getTokenCount();
  public boolean isEmpty();
}
```

## Parsing

The `parse` method parses an HTML document with embedded Ruby and returns a `ParseResult` containing the parsed AST.

### `Herb.parse(String source)`

:::code-group
```java
import org.herb.Herb;
import org.herb.ParseResult;

String source = "<p>Hello <%= user.name %></p>";

ParseResult result = Herb.parse(source);

System.out.println(result.inspect();
// Output:
// @ DocumentNode (location: (1:0)-(1:29))
// └── children: (1 item)
//     └── @ HTMLElementNode (location: (1:0)-(1:29))
//         ├── open_tag:
//         │   └── @ HTMLOpenTagNode (location: (1:0)-(1:3))
//         │       ├── tag_opening: "<" (location: (1:0)-(1:1))
//         │       ├── tag_name: "p" (location: (1:1)-(1:2))
//         │       ├── tag_closing: ">" (location: (1:2)-(1:3))
//         │       ├── children: []
//         │       └── is_void: false
//         │
//         ├── tag_name: "p" (location: (1:1)-(1:2))
//         ├── body: (2 items)
//         │   ├── @ HTMLTextNode (location: (1:3)-(1:9))
//         │   │   └── content: "Hello "
//         │   │
//         │   └── @ ERBContentNode (location: (1:9)-(1:25))
//         │       ├── tag_opening: "<%=" (location: (1:9)-(1:12))
//         │       ├── content: " user.name " (location: (1:12)-(1:23))
//         │       ├── tag_closing: "%>" (location: (1:23)-(1:25))
//         │       ├── parsed: false
//         │       └── valid: false
//         │
//         ├── close_tag:
//         │   └── @ HTMLCloseTagNode (location: (1:25)-(1:29))
//         │       ├── tag_opening: "</" (location: (1:25)-(1:27))
//         │       ├── tag_name: "p" (location: (1:27)-(1:28))
//         │       ├── children: []
//         │       └── tag_closing: ">" (location: (1:28)-(1:29))
//         │
//         ├── is_void: false
//         └── source: ""
```
:::

### `Herb.parse(String source, ParserOptions options)`

Parse with custom options:

:::code-group
```java
import org.herb.Herb;
import org.herb.ParseResult;
import org.herb.ParserOptions;

ParserOptions options = new ParserOptions();
ParseResult result = Herb.parse(source, options);
```
:::

### `ParseResult`

The `ParseResult` class provides access to the parsed AST and any errors:

```java
public class ParseResult {
  public Node value;
  public List<Node> errors;
  public String source;
  public boolean hasErrors();
  public int getErrorCount();
  public boolean isSuccessful();
}
```

## Extracting Code

### `Herb.extractRuby(String source)`

The `extractRuby` method extracts only the Ruby parts of an HTML document with embedded Ruby.

:::code-group
```java
import org.herb.Herb;

String source = "<p>Hello <%= user.name %></p>";

String ruby = Herb.extractRuby(source);
System.out.println(ruby);
// Output: "             user.name       "
```
:::

### `Herb.extractHTML(String source)`

The `extractHTML` method extracts only the HTML parts of an HTML document with embedded Ruby.

:::code-group
```java
import org.herb.Herb;

String source = "<p>Hello <%= user.name %></p>";

String html = Herb.extractHTML(source);
System.out.println(html);
// Output: "<p>Hello                 </p>"
```
:::

## Version Information

### `Herb.version()`

Returns the full version information including Herb, Prism, and JNI details:

:::code-group
```java
import org.herb.Herb;

System.out.println(Herb.version());
// Output: "herb java v0.7.5, libprism v1.6.0, libherb v0.7.5 (Java JNI)"
```
:::

### `Herb.herbVersion()`

Returns just the Herb library version:

:::code-group
```java
import org.herb.Herb;

System.out.println(Herb.herbVersion());
// Output: "0.7.5"
```
:::

### `Herb.prismVersion()`

Returns the Prism parser version:

:::code-group
```java
import org.herb.Herb;

System.out.println(Herb.prismVersion());
// Output: "1.6.0"
```
:::

## Core Types

### Position

Represents a position in the source code:

```java
public class Position {
  public int getLine();
  public int getColumn();
  public String inspect();
}
```

### Location

Represents a location span in the source:

```java
public class Location {
  public Position getStart();
  public Position getEnd();
}
```

### Range

Represents a byte range in the source:

```java
public class Range {
  public int getStart();
  public int getEnd();
  public String inspect();
}
```

### Token

Represents a token from lexing:

```java
public class Token {
  public String getType();
  public String getValue();
  public Location getLocation();
  public Range getRange();
  public String inspect();
  public String treeInspect();
}
```

## AST Node Types

All AST nodes implement the `Node` interface:

```java
public interface Node {
  String getNodeType();
  Location getLocation();
  List<Node> getErrors();
  String inspect();
  <T> T accept(Visitor<T> visitor);
}
```

### Error Handling

Parse errors are accessible through the `ParseResult`:

```java
ParseResult result = Herb.parse(source);

if (result.hasErrors()) {
  for (Node error : result.recursiveErrors()) {
    System.out.println(error.inspect());
  }
}
```

## Visitor Pattern

The Java bindings support the visitor pattern for traversing the AST:

```java
import org.herb.ast.Visitor;
import org.herb.ast.Node;

public class MyVisitor implements Visitor<Void> {
  @Override
  public Void visitHTMLElementNode(HTMLElementNode node) {
    System.out.println("Found HTML element: " + node.getTagName());
    return null;
  }

  // Implement other visit methods...
}

ParseResult result = Herb.parse(source);
Node root = result.getValue();
MyVisitor visitor = new MyVisitor();
root.accept(visitor);
```
