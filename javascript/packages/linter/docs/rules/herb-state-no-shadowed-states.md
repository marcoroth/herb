# Linter Rule: Disallow block arguments that shadow a declared `herb:state` name

**Rule:** `herb-state-no-shadowed-states`

## Description

Flags a block argument, a `for` loop variable, or a `render` block argument whose name matches a state the template declares.

## Rationale

A declared state is a Ruby local the template assigns at the top, so a block argument of the same name shadows it, the way Ruby always resolves names. Inside that block every read reaches the argument, the state becomes unreachable, and nothing the client writes can steer what the block renders. The compiler resolves the shadowing the same way Ruby does, so the template still compiles, which is exactly why the collision is easy to miss.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (track: "") %>

<% songs.each do |entry| %>
  <p><%= entry %></p>
<% end %>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (track: "") %>

<% songs.each do |track| %>
  <p><%= track %></p>
<% end %>
```

## References

\-
