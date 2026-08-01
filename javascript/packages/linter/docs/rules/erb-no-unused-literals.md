# Linter Rule: Disallow Ruby literals in ERB without output

**Rule:** `erb-no-unused-literals`

## Description

Disallow Ruby literal values inside ERB tags that do not produce output or side effects. Writing literals like `<% "string" %>` or `<% 123 %>` has no effect. The value is evaluated and discarded, making the line functionally useless.

This rule detects and warns about ERB tags containing:

- Literal strings
- Numeric values (integers, floats, rationals, imaginary)
- `true` and `false`
- `nil`
- Symbols
- Arrays, hashes, and ranges
- Regular expressions

## Rationale

These expressions are evaluated but unused, they don't produce output (not `<%= ... %>`), and they don't perform side effects (no assignments, method calls, or control flow). They're likely accidental leftovers, debugging artifacts, or misunderstandings of ERB syntax.

## Examples

### ✅ Good

```erb
<% if logged_in? %>
  <p>Welcome!</p>
<% end %>
```

```erb
<%= "Hello, #{user.name}" %>
```

### 🚫 Bad

```erb
<% "Logged in" %>
```

```erb
<% 42 %>
```

```erb
<% true %>
```

```erb
<% false %>
```

```erb
<% nil %>
```

```erb
<% [:foo, :bar] %>
```

```erb
<% /pattern/ %>
```

```erb
<% { key: "value" } %>
```

```erb
<% :symbol %>
```

## References

\-
