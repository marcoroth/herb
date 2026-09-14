# Linter Rule: Disallow inline case conditions

**Rule:** `erb-no-inline-case-conditions`

## Description

Disallow placing `case` and its first `when`/`in` condition in the same ERB tag. This rule flags such patterns and guides users toward separate ERB tags.

## Rationale

The parser handles this pattern by splitting the tag, so the `case` and its first condition each own the Ruby they introduce. The template then compiles the same as one written with separate tags, and `herb format` rewrites it into that shape for you.

What the shared tag costs is readability. The `case` expression and its first branch run together in one tag while every later branch gets its own, so the branches no longer line up. Separate tags also match the conventional ERB style used across the Ruby on Rails ecosystem.

Two parser errors cover the same shape from a different angle. Under [strict parsing](/parser-options), which is the default, `ERB_CASE_WITH_CONDITIONS_ERROR` rejects the tag outright, so this rule only reports where strict mode is off. A `case` and its first `in` pattern on the same line (`<% case x in y %>`) is Ruby's one-line pattern match instead of a `case`/`in`, so `ERB_CASE_INLINE_PATTERN_MATCH_ERROR` reports it in both modes. That one is a real parse failure, so `herb format` leaves it for you to fix.

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
