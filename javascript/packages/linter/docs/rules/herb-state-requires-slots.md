# Linter Rule: Require a `herb:slots` directive for `herb:state`

**Rule:** `herb-state-requires-slots`

## Description

Requires a template that declares `herb:state` to also opt into slots with a `<%# herb:slots %>` directive.

## Rationale

State machinery only compiles when the template declares slots. Without the directive the `herb:state` comment is just a comment, the template renders normally, every action attribute wires up, and then nothing ever changes on screen, with no error anywhere.

Either mode makes the states live. Client mode parks branch markup up front, so client-decidable switches are instant and work offline. Server mode fetches a branch on demand and carries its markup in the values payload, trading a round trip for a smaller page. The rule takes no position between them, it only asks the template to pick one explicitly.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (open: false) %>

<button data-herb-toggle="open">Details</button>
<% if open? %><nav>Menu</nav><% end %>
```

```erb
<%# herb:slots server %>
<%# herb:state (track: "") %>

<li><%= track %></li>
```

### 🚫 Bad

```erb
<%# herb:state (open: false) %>

<button data-herb-toggle="open">Details</button>
<% if open? %><nav>Menu</nav><% end %>
```

## References

- [`herb-component-requires-slots`](./herb-component-requires-slots.md)
