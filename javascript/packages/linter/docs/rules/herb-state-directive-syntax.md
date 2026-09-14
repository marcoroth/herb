# Linter Rule: Spell the `herb:state` directive in its canonical form

**Rule:** `herb-state-directive-syntax`

## Description

Require `<%# herb:state (...) %>` to be written on one line, with exactly one space after `<%#`, one space before the signature, and one space before `%>`. Trim markers are not allowed on either delimiter.

## Rationale

The parser recognizes the directive permissively so it can refuse a bad spelling with a diagnostic. Were it to simply stop matching, the states would quietly cease to exist and the failure would surface much later as an undefined local, far from the line that caused it.

Keeping one spelling means every consumer reads a directive the same way. Leading indentation stays legal, since item-scoped states are declared inside `<% items.each do |item| %>` blocks and are normally indented.

## Examples

### ✅ Good

```erb
<%# herb:state (open: false) %>
<%# herb:state (open: false, count: 0, title: "") %>

<% items.each do |item| %>
  <%# herb:state (selected: false) %>
<% end %>
```

### 🚫 Bad

```erb
<%#- herb:state (open: false) -%>
<%#herb:state (open: false) %>
<%# herb:state  (open: false) %>
<%# herb:state (open: false)%>

<%# herb:state (
  open: false,
  count: 0
) %>
```

## Autofix

This rule is autocorrectable. The fix rewrites the directive into its canonical spelling, joining a multi-line signature onto one line and collapsing runs of whitespace outside string literals, so a default like `(title: "a  b")` keeps its spacing.

## References

- [`herb-state-valid-declaration`](./herb-state-valid-declaration.md) validates what the signature declares, while this rule validates how the directive is spelled.
