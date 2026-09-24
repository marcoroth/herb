# Linter Rule: Validate the kind a bound form control holds

**Rule:** `herb-state-valid-bindings`

## Description

Validates two-way bindings between form controls and declared states. A `checked` or `selected` attribute reading a state binds a boolean, so the state must be declared as one. A `value` attribute or a `<textarea>`'s content holds text, so the state must be a String, or an Integer for numeric inputs. A derived state cannot be bound at all, since a binding writes back what the user changes and a derived value follows from its sources. A `value` binding on a `<select>` is reported whatever it reads, because HTML has no `value` attribute on a `<select>`.

## Rationale

A state read into a form control is a two-way binding by construction. The control writes the state back on `input` or `change`, so the kinds have to line up. A checkbox writing into a String state would store `"true"` where a boolean is expected, and a `value` displaying a Boolean would render the word and then overwrite the flag with arbitrary text.

The type comes from the declaration's default, which is why declaring states with primitive defaults matters. A state seeded from an expression has no static kind and is exempt.

A `<select>` is the one control where the binding itself is wrong, and it is wrong in a way that only shows up for some values. The attribute compiles to a slot, and picking an option does write the state, so the page looks correct as long as the state holds what the first option carries. The browser ignores a `value` attribute on a `<select>` though, so a page rendered with any other value serves `value="newest"` while the select still reads `oldest` and shows the first option. Write the choice with the [`data-herb-set`](./herb-state-valid-actions.md) action instead, which writes the state when the user picks an option, and mark the rendered option with `selected` so the current value renders selected. Both halves are needed, since `selected` on its own renders the right option and never writes the state back.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (draft: "", agreed: false, attempts: 0, order: "oldest") %>

<input value="<%= draft %>" autocomplete="off">
<input type="checkbox" checked="<%= agreed %>">
<textarea><%= draft %></textarea>
<input type="number" value="<%= attempts %>" autocomplete="off">

<select data-herb-set="order=$value">
  <option value="oldest" selected="<%= order == "oldest" %>">Oldest first</option>
  <option value="newest" selected="<%= order == "newest" %>">Newest first</option>
</select>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (draft: "", agreed: false, order: "oldest") %>

<input type="checkbox" checked="<%= draft %>">
<input value="<%= agreed %>" autocomplete="off">
<textarea><%= agreed %></textarea>

<select value="<%= order %>">
  <option value="oldest">Oldest first</option>
  <option value="newest">Newest first</option>
</select>
```

## References

- [Language reference: State, Writing a state](https://herb-tools.dev/language/state#writing-a-state)
