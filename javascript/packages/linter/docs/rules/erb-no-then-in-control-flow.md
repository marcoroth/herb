**Rule:** `erb-no-then-in-control-flow`

## Description

Disallow the use of the Ruby `then` keyword in control flow expressions inside ERB templates. This applies to:

- `if … then`
- `elsif … then`
- `unless … then`
- `case … when … then`
- `case … in … then`

## Rationale

While Ruby allows the `then` keyword, its use inside ERB templates significantly reduces readability and adds confusion/ambiguity.

In templates, clarity matters more than terseness. The multiline form:

- Is easier to read and review
- Works better with indentation and formatting rules
- Avoids subtle parsing confusion in mixed HTML/Ruby contexts
- Matches idiomatic Rails view style

This rule enforces a consistent, block-oriented style for control flow in ERB.

## Examples

### Good

```erb
<% if condition %>
  yes
<% end %>
```

```erb
<% unless logged_in? %>
  please log in
<% end %>
```

```erb
<% case status %>
<% when :ok %>
  success
<% when :error %>
  failure
<% else %>
  unknown
<% end %>
```

```erb
<% case value %>
<% in Integer %>
  number
<% in String %>
  string
<% end %>
```

### Bad

```erb
<% if condition then %>
  yes
<% end %>
```

```erb
<% case status %>
<% when :ok then %>
  success
<% end %>
```

```erb
<% case value %>
<% in Integer then "number" %>
<% in String then "text" %>
<% end %>
```

## References

- [GitHub Issue #1077](https://github.com/marcoroth/herb/issues/1077)
