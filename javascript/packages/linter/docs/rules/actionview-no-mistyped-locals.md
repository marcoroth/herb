# Linter Rule: Disallow mistyped literals for strict locals

**Rule:** `actionview-no-mistyped-locals`

## Description

Flags a literal argument in a `render` call whose type contradicts the strict local's declared default type in the partial, like passing `"yes"` where the partial declares `open: false`.

## Rationale

A strict local's default is the one piece of type information a partial publishes, and its body is written against it. A partial comparing `size == :lg` never matches when the caller passed `"lg"`, and a partial treating `open` as a flag renders the truthy arm for any non-empty String. Rails cannot catch this, since locals are untyped, so the mistake surfaces as wrong rendering rather than an error.

Only literals are checked. A method call or variable argument cannot be typed statically, so this is defense in depth, not a guarantee. `nil` is allowed against any declared type, and a local declared without a default or with a `nil` default accepts anything.

The check also guards state seeding. A `herb:state` default naming a strict local takes its type from that local's default, so a mistyped call site would seed the wrong type into client state.

## Examples

Given `app/views/application/_menu.html.erb` declaring:

```erb
<%# locals: (open: false, size: "md") %>

<div class="menu <%= size %>">
  <% if open %>Open<% end %>
</div>
```

### ✅ Good

```erb
<%= render "application/menu", open: true, size: "lg" %>

<%= render "application/menu", open: menu_open? %>

<%= render "application/menu", size: nil %>
```

### 🚫 Bad

```erb
<%= render "application/menu", open: "yes" %>

<%= render "application/menu", size: :lg %>
```

## References

\-
