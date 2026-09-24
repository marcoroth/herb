---
outline: deep
---

# Working with the tree

A parse gives you a `DocumentNode` and everything under it. There are two ways to get at what you want, which are walking the whole tree with a visitor and asking which node sits at a position.

## Visitors

A visitor defines a method per node type, and the walk calls yours for the nodes you care about while descending into the rest on its own.

::: code-group
```ruby [Ruby]
class TextNodeVisitor < Herb::Visitor
  def visit_html_text_node(node)
    puts "HTML TextNode #{node.content}"
  end
end

result = Herb.parse("<p>Hello <%= user.name %></p>")
result.visit(TextNodeVisitor.new)
```

```js [JavaScript]
import { Herb, Visitor } from "@herb-tools/node"

class TextNodeVisitor extends Visitor {
  visitHTMLTextNode(node) {
    console.log("HTML TextNode", node.content)
  }
}

const result = Herb.parse("<p>Hello <%= user.name %></p>")
result.visit(new TextNodeVisitor())
```

```java [Java]
import org.herb.ast.Visitor;
import org.herb.ast.HTMLTextNode;

public class TextNodeVisitor implements Visitor<Void> {
  @Override
  public Void visitHTMLTextNode(HTMLTextNode node) {
    System.out.println("HTML TextNode " + node.getContent());
    return null;
  }
}

ParseResult result = Herb.parse("<p>Hello <%= user.name %></p>");
result.getValue().accept(new TextNodeVisitor());
```

```rust [Rust]
use herb::{parse, Visitor};
use herb::ast::HTMLTextNode;

struct TextNodeVisitor;

impl Visitor for TextNodeVisitor {
  fn visit_html_text_node(&mut self, node: &HTMLTextNode) {
    println!("HTML TextNode {}", node.content);
    self.walk_html_text_node(node);
  }
}

let result = parse("<p>Hello <%= user.name %></p>").unwrap();
TextNodeVisitor.visit_document_node(&result.value);
```
:::

In Ruby and JavaScript the walk starts from the result. In Java a node accepts the visitor, and in Rust the visitor is handed the node. Each `visit_*` method in Rust calls the matching `walk_*` to keep descending, so an override that should not stop the walk calls it too.

## Locating a node

`locate` finds the most specific node at a position, and the nodes it sits inside. A position that comes back from a rendered page, an editor or a diagnostic is a node before it is anything anyone can act on, and this turns one into the other.

::: code-group
```ruby [Ruby]
result = Herb.parse("<div><span>hi</span></div>")
found = result.locate(Herb::Position[1, 12])

found.node
# => #<Herb::AST::HTMLTextNode>

found.ancestors.map(&:class)
# => [Herb::AST::HTMLElementNode, Herb::AST::HTMLElementNode, Herb::AST::DocumentNode]

found.innermost(Herb::AST::HTMLElementNode).tag_name.value
# => "span"
```

```js [JavaScript]
import { Position, isHTMLElementNode } from "@herb-tools/core"

const result = Herb.parse("<div><span>hi</span></div>")
const found = result.locate(Position.from(1, 12))

found.node
// => HTMLTextNode

found.ancestors.map((node) => node.constructor.name)
// => ["HTMLElementNode", "HTMLElementNode", "DocumentNode"]

found.innermost(isHTMLElementNode)?.tag_name.value
// => "span"
```

```rust [Rust]
use herb::position::Position;

let result = parse("<div><span>hi</span></div>").unwrap();
let found = result.locate(Position::new(1, 12)).unwrap();

found.node.node_type();
// => "AST_HTML_TEXT_NODE"

found.ancestors.iter().map(|node| node.node_type()).collect::<Vec<_>>();
// => ["AST_HTML_ELEMENT_NODE", "AST_HTML_ELEMENT_NODE", "AST_DOCUMENT_NODE"]

found.innermost(|node| node.node_type() == "AST_HTML_ELEMENT_NODE");
// => the nearest element the position is inside
```
:::

Java has no `locate` yet, so a Java caller walks with a visitor and compares locations.

### The rules it follows

A node's location contains its start and stops short of its end, so two nodes sitting next to each other never both answer for the character between them. A node with no location of its own answers for nothing, which keeps a synthesized node from swallowing the position of the node it was built next to. A position outside everything the given node covers belongs to no node, and comes back as `nil` in Ruby, `null` in JavaScript and `None` in Rust.

Ancestors read nearest first, so the enclosing element a caller wants is the first one that answers. `innermost` starts with the node itself, so it answers with the node when the node already matches. `path` reads the other way around, outermost first, and ends with the node that was found. Columns are 0-based character offsets into their line, which is what the parser reports.

Every node answers too, so a walk can start from the node a caller already holds. `result.locate(position)` and `node.locate(position)` are the same walk from different starting points. `locatable?` in Ruby, `locatable` in JavaScript, asks the same question without walking.

The walk goes by how much source a node and everything it holds cover together, which is not the same as the node's own location. A branch of an `if` holds the branch after it, and each branch is positioned where it was written, so the node holding the chain ends before what it holds. Walking by a node's own location would leave every branch but the first unreachable. `ancestors` is therefore the walk that was taken, whether or not each node along it covers the position itself, and a caller that wants only the nodes the position is really inside filters on whether the location contains it.

## What a node carries

Every node has a type, a location and the errors found inside it, whatever the binding.

::: code-group
```ruby [Ruby]
node.type
node.location.start.line
node.errors
node.recursive_errors
node.tree_inspect
```

```js [JavaScript]
node.type
node.location.start.line
node.errors
node.recursiveErrors()
node.inspect()
```

```java [Java]
node.getNodeType();
node.getLocation().getStart().getLine();
node.getErrors();
node.inspect();
```

```rust [Rust]
node.node_type();
node.location().start.line;
node.errors();
node.recursive_errors();
node.tree_inspect();
```
:::

A `Position` is a line and a column, a `Location` is a start and an end position, and a `Range` is a pair of byte offsets. [AST Nodes](/c-reference/nodes) lists every node type and its fields.

## Next

[Versions](/bindings/versions) reports which Herb and Prism a binding is running.
