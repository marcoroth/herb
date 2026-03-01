# Linter Rule: Disallow inline case conditions

**Rule:** `erb-no-inline-case-conditions`

## Description

Disallow placing `case` and its first `when`/`in` condition in the same ERB tag. When a `case` statement and its condition appear in a single ERB tag (e.g., `<% case x when y %>`), the parser cannot reliably process, compile, or format the template. This rule flags such patterns and guides users toward separate ERB tags.

## Rationale

ERB templates that combine `case` with a `when` or `in` condition in a single tag create parsing ambiguity. The parser creates synthetic condition nodes to handle this pattern in non-strict mode, but the resulting AST cannot be reliably formatted or compiled.

Using separate ERB tags for `case` and its conditions:

- Makes the template structure unambiguous for the parser
- Enables proper formatting and compilation
- Improves readability by clearly separating the case expression from its branches
- Follows the conventional ERB style used across the Ruby on Rails ecosystem

## Examples

### ✅ Good

`case`/`when` in separate ERB tags:

```erb
<% case variable %>
<% when "a" %>
  A
<% when "b" %>
  B
<% else %>
  Other
<% end %>
```

`case`/`in` (pattern matching) in separate ERB tags:

```erb
<% case value %>
<% in 1 %>
  One
<% in 2 %>
  Two
<% else %>
  Other
<% end %>
```

### 🚫 Bad

Inline `case`/`when` in a single ERB tag:

```erb
<% case variable when "a" %>
  A
<% when "b" %>
  B
<% end %>
```

Inline `case`/`in` in a single ERB tag:

```erb
<% case value in 1 %>
  One
<% in 2 %>
  Two
<% end %>
```

`case`/`when` on separate lines but still in the same ERB tag:

```erb
<% case variable
   when "a" %>
  A
<% when "b" %>
  B
<% end %>
```

## References

\-
