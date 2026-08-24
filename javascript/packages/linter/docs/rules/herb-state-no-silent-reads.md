# Linter Rule: Disallow bare state reads in silent tags

**Rule:** `herb-state-no-silent-reads`

## Description

Disallows a silent ERB tag whose whole content is a bare read of a declared state, like `<% draft %>`.

## Rationale

A silent tag evaluates its expression and throws the result away, and a state read has no side effect to keep. The line renders nothing, changes nothing, and looks like it does one or the other. The author usually meant `<%= draft %>` to show the value, or wanted to change the state, which happens through `data-herb-set` and its siblings in markup and through `state.set` in app code, never through ERB.

The generic `erb-no-unused-expressions` rule steps aside for declared states inside their scope, so one mistake draws this one state-aware offense.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (draft: "") %>

<p><%= draft %></p>
<button data-herb-set="draft=">Clear</button>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (draft: "") %>

<% draft %>
<input value="<%= draft %>">
```

## References

\-
