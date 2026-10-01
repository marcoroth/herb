# Language

Herb reads the HTML and the ERB in a template as one document. Most of what that gives you needs nothing new in your templates. The linter, the formatter, the language server and the engine all work on the `.html.erb` files you already have.

For templates whose parts update in the browser after the page loads, Herb adds a small amount of syntax of its own. Directives are ERB comments and actions are HTML attributes, so a template that uses them still reads as ordinary HTML+ERB.

| Construct | Written as | Reference |
| --- | --- | --- |
| Templates | `.html.erb`, `.herb` | [Templates](/language/templates) |
| ERB syntax | `<%= %>`, `<% if %>`, `<%# %>` | [ERB Syntax](/language/erb) |
| State | `<%# herb:state (open: false) %>` | [State](/language/state) |
| Actions | `data-herb-toggle="open"` | [Actions](/language/actions) |
| Keys and collections | `<%# herb:key message.id %>`, `data-herb-into` | [Keys and collections](/language/keys) |
| Slots | `<%# herb:slots client %>` | [Slots](/language/slots) |
| Components | `<Fragment>`, `<Async>`, `<Lazy>`, `<Fallback>` | [Components](/language/components) |
| Scoped styles | `<style scoped>` | [Scoped styles](/language/scoped-styles) |
| Strict locals | `<%# locals: (title:) %>` | [Strict locals](/language/strict-locals) |

These pages are reference. Each one says what a construct does, what it accepts and what it rejects. For a guided introduction that builds a working page in a Rails app, start with [ReActionView](https://reactionview.dev/overview), which wires everything here into Action View.

::: warning Slots are experimental
State, actions, keys, slots, components and scoped styles are experimental in Herb `^0.11.0`. The markers they write into the page, the payload the server sends and the client API may change between releases. The engine prints the same notice when it compiles a template with slots.
:::
