# Linter Rule: Disallow inline case conditions

**Rule:** `erb-no-inline-case-conditions`

## Description

Disallow placing `case` and its first `when`/`in` condition in the same ERB tag. This rule flags such patterns and guides users toward separate ERB tags.

## Rationale

The parser handles this pattern by splitting the tag, so the `case` and its first condition each own the Ruby they introduce. The template compiles and formats the same as one written with separate tags, and the formatter rewrites it into that shape.

What the shared tag costs is readability. The `case` expression and its first branch run together in one tag while every later branch gets its own, so the branches no longer line up. Separate tags also match the conventional ERB style used across the Ruby on Rails ecosystem.

One shape is a parse error rather than a style offense. A `case` and its first `in` pattern on the same line (`<% case x in y %>`) is Ruby's one-line pattern match, not a `case`/`in`, so the parser reports `ERB_CASE_WITH_CONDITIONS_ERROR` for it.

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
