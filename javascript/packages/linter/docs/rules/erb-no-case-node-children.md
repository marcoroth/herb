# Linter Rule: Don't use `children` for `case/when` and `case/in` nodes

**Rule:** `erb-no-case-node-children`

## Description

Disallow placing content or expressions directly between the opening `<% case %>` and the first `<% when %>` or `<% in %>` clause in an HTML+ERB template.

In Ruby and ERB, `case` expressions are intended to branch execution. Any content placed between the `case` and its `when`/`in` clauses is not executed as part of the branching logic, and may lead to confusion, orphaned output, or silent bugs.

## Rationale

Including content directly inside a `case block` is likely unintended and often leads to unclear or broken rendering logic.

Most developers expect that nothing happens until the first `when`/`in` matches. Content in that location is often a copy/paste or indentation mistake and should be flagged to maintain clarity and correctness in templates.

This mirrors how `case` works in Ruby itself and helps avoid surprising output.

## Examples

### ✅ Good

```erb
<% case variable %>
<% when "a" %>
  A
<% when "b" %>
  B
<% else %>
  C
<% end %>
```

### 🚫 Bad

```erb
<% case variable %>
  This content is outside of any when/in/else block!
<% when "a" %>
  A
<% when "b" %>
  B
<% else %>
  C
<% end %>
```

## References

\-
