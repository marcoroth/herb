---
outline: deep
---

# `OptimizeVisitor` <Badge type="warning" text="experimental" />

Asks the parser to resolve Action View helpers into the markup they produce, so the compiler emits that markup instead of a call the renderer has to make.

```ruby
require "herb/engine/visitors/optimize_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::OptimizeVisitor.new])
```

`<%= tag.div do %>Content<% end %>` compiles to `<div>Content</div>` with no helper call left at all. Only the helpers the registry marks supported are resolved.

An output tag that carries only a string, integer, or float literal renders the same text every time, so the visitor folds it into the template text around it, with the escaping the renderer would have applied already applied. `<%= "hello" %>` compiles to the text `hello`, and with `escape: true`, `<%= "it's" %>` compiles to `it&#39;s`. The fold follows the tag's position, so a literal in an attribute value takes the attribute escape, and one inside `<script>` or `<style>` takes the JavaScript or CSS escape. A literal that spans lines, sits in a trimming tag, or renders nothing stays dynamic, and so does one whose escape function the caller swapped out through `escapefunc`, `attrfunc`, `jsfunc`, or `cssfunc`, unless the stock function leaves the value untouched.

Its presence also collapses a template that carries no Ruby into the single string literal it renders, with none of the buffer the compiler would otherwise build up. `<div>Static</div>` compiles to `'<div>Static</div>'`. A template written as HTML qualifies on its own, and one left fully static once its helpers resolved to markup and its literals folded into text qualifies too, so `<%= tag.br %>` compiles to `'<br>'` and `<h1><%= "hello" %></h1>` to `'<h1>hello</h1>'`.

A template whose only Ruby is conditional chains over otherwise static markup collapses the same way, `case` and pattern matching included, nesting too, into the chains themselves picking between one frozen string literal per render path:

```erb
<p>
  <% if signed_in? %>
    Hello World
  <% else %>
    Hello Tomorrow
  <% end %>
</p>
```

```ruby
if signed_in?
 "<p>\n    Hello World\n</p>\n".freeze;
else
 "<p>\n    Hello Tomorrow\n</p>\n".freeze;
end
```

Each literal holds everything its path renders, the markup around and between the conditionals included, so a conditional attribute inside a conditional element still collapses:

```erb
<select>
<% if signed_in? %>
<option <%= tag.attributes(selected: option == current) %>>One</option>
<% else %>
<option>None</option>
<% end %>
</select>
```

```ruby
if signed_in? 
if (option == current); "<select>\n<option selected>One</option>\n</select>\n".freeze; else "<select>\n<option >One</option>\n</select>\n".freeze;end;
else 
 "<select>\n<option>None</option>\n</select>\n".freeze;
end 
```

The conditions compile onto the lines they were written on, so backtraces stay right, and a chain without an `else` gets one that returns what the template renders without it. A pattern matching chain is the exception, since it keeps raising `NoMatchingPatternError` for a value no pattern accepts. The path literals repeat the markup the paths share, so the collapse steps back once they would hold more than four times the template's static bytes, and the buffer stays. A branch that carries an expression keeps the buffer, and so does a chain that sits beside another in the same scope.

A template that keeps its buffer can still get its static subtrees, with `subtrees: true`. A chain whose branches are static collapses into a single append of the chain picking between path literals, with the static text around it merged in, so a conditional attribute next to a dynamic one renders in one append where it took three:

```ruby
_buf << '<option class="'.freeze; _buf << ::Herb::Engine.attr((kind)); _buf << (if (option == current); "\" selected>One</option>".freeze; else "\">One</option>".freeze;end;).to_s;
```

A chain the buffer already renders in one append is left as it was. The pass trades compiled template bytes for fewer appends at render time, which is why it is the one pass that is off by default.

The `herb compile --optimize` and `herb render --optimize` commands wire the visitor up from the command line. The engine keeps the buffer when the caller drives it through `preamble`, `postamble`, `bufval`, or `ensure`, and when a visitor recorded a diagnostic the compiled template still has to report.

Every pass except `subtrees` is on by default, and each can be toggled on its own. `helpers: false` stops asking the parser to resolve helpers, `conditionals: false` stops asking it to unroll the postfix conditionals and ternaries it would have, `literals: false` keeps literal outputs dynamic, and `collapse: false` keeps the buffer for a template either collapse would have compiled without one:

```ruby
Herb::Engine::OptimizeVisitor.new(literals: false, collapse: false)
```

Turning a parser-side pass off only withdraws the visitor's request for the parser option behind it. A caller that asks for `action_view_helpers: true` through `parser_options` still gets the resolution the parser was asked for directly. Unrolling is also part of how the parser resolves helpers, since a helper behind a modifier has to come out of it first, so a modifier keeps its written shape only once `helpers` is off too.

Replacing a helper call with its markup is the same thing as calling it only while the helper is the one it was resolved against. An application that defines its own `content_tag` gets the stock markup everywhere instead of its own, with nothing at the call site to say so. `verify` compiles a check into the template that reports a helper that has since been overwritten:

```ruby
Herb::Engine::OptimizeVisitor.new(verify: true)
```

It reports rather than raises, because the markup is already rendered by the time the check runs:

```
app/views/posts/index.html.erb:1:1: [overwritten-helper] `tag` was compiled away as
ActionView::Helpers::TagHelper, but here it is defined by ApplicationHelper.
```

The check costs a call per render and only reports, so it belongs in development rather than production, and compiling it in is opt-in for the same reason the optimization is.
