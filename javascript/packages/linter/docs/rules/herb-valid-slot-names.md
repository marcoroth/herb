# Linter Rule: Validate `data-herb-name` slot names

**Rule:** `herb-valid-slot-names`

## Description

Validates `data-herb-name` attributes. A name must be a static, non-empty value, unique among the named slots in its scope, distinct from the attribute slots in that scope, and placed on an element that actually holds something dynamic.

## Rationale

A slot name is an address client code resolves through the schema, so it cannot be computed, and two slots answering to one name would make `slotInItem(file, collection, key, "body")` ambiguous. An attribute slot is already addressable by its attribute, so authoring the same name shadows nothing and confuses everything. A name on a fully static element names no slot at all, which is a leftover or a typo.

The engine raises each of these as a compile error when the template renders. This rule reports the same findings in the editor first. The same name may repeat across nesting levels, an item-scoped `body` beside a region-scoped `body` is the loop running, not a duplicate.

## Examples

### ✅ Good

```erb
<ul data-herb-name="messages">
  <% @messages.each do |message| %>
    <li id="<%= dom_id(message) %>">
      <p data-herb-name="body"><%= message.body %></p>
    </li>
  <% end %>
</ul>
```

### 🚫 Bad

```erb
<p data-herb-name="<%= field %>"><%= message.body %></p>

<p data-herb-name="body"><%= @intro %></p>
<p data-herb-name="body"><%= @outro %></p>

<p data-herb-name="body">just static text</p>
```

## References

\-
