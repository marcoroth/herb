---
outline: deep
---

# `RemoveCommentsVisitor`

Removes comments, so that the compiled output never contains one.

An HTML comment is served to the browser and is readable by anyone who looks at the page source, so a note the template author wrote for other developers ends up in production.

```ruby
require "herb/engine/visitors/remove_comments_visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::RemoveCommentsVisitor.new])
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
  Herb::Engine::RemoveCommentsVisitor.new,
  Herb::Engine::Slots::Visitor.new
])
```

Either order renders the same markup, with the template's own comments gone and every slot marker left in place.

The whitespace around a comment is left where it was, so removing one never changes how the elements next to it are laid out. A comment on a line of its own leaves that line's whitespace behind. That includes an ERB comment, where the compiler on its own would have trimmed the line away.

Comment syntax inside a `<script>` or `<style>` element is part of that element's text instead of an HTML comment, so it stays.
