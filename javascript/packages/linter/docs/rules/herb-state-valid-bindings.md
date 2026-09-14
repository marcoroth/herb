# Linter Rule: Validate the kind a bound form control holds

**Rule:** `herb-state-valid-bindings`

## Description

Validates two-way bindings between form controls and declared states. A `checked` or `selected` attribute reading a state binds a boolean, so the state must be declared as one. A `value` attribute or a `<textarea>`'s content holds text, so the state must be a String, or an Integer for numeric inputs. A derived state cannot be bound at all, since a binding writes back what the user changes and a derived value follows from its sources.

## Rationale

A state read into a form control is a two-way binding by construction. The control writes the state back on `input` or `change`, so the kinds have to line up. A checkbox writing into a String state would store `"true"` where a boolean is expected, and a `value` displaying a Boolean would render the word and then overwrite the flag with arbitrary text.

The type comes from the declaration's default, which is why declaring states with primitive defaults matters. A state seeded from an expression has no static kind and is exempt.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (draft: "", agreed: false, attempts: 0) %>

<input value="<%= draft %>" autocomplete="off">
<input type="checkbox" checked="<%= agreed %>">
<textarea><%= draft %></textarea>
<input type="number" value="<%= attempts %>" autocomplete="off">
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (draft: "", agreed: false) %>

<input type="checkbox" checked="<%= draft %>">
<input value="<%= agreed %>" autocomplete="off">
<textarea><%= agreed %></textarea>
```

## References

\-
