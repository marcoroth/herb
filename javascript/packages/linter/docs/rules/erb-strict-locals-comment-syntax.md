# Linter Rule: Enforce strict locals comment syntax

**Rule:** `erb-strict-locals-comment-syntax`

## Description

Ensures that strict locals comments use the exact `locals: ( ... )` syntax so they are properly recognized by Rails and tooling. Also validates that only keyword arguments are used (no positional, block, or splat arguments).

## Rationale

Strict locals comments declare which locals are expected in a template. Misspellings or malformed syntax silently disable the declaration, leading to confusing runtime errors when required locals are missing.

Additionally, Rails only supports keyword arguments in strict locals declarations. Positional, block, and splat arguments will raise an `ActionView::Error` at render-time.

This rule catches invalid comment forms and argument types early during development.

## Examples

### ✅ Good

Required keyword argument:

```erb
<%# locals: (user:) %>
```

Keyword argument with default value:

```erb
<%# locals: (user:, admin: false) %>
```

Complex default values:

```erb
<%# locals: (items: [], config: {}) %>
```

No locals (empty):

```erb
<%# locals: () %>
```

Double-splat for optional keyword arguments:

```erb
<%# locals: (message: "Hello", **attributes) %>
```

### 🚫 Bad

#### Wrong comment syntax

Missing colon after `locals`:

```erb
<%# locals() %>
```

Singular `local` instead of `locals`:

```erb
<%# local: (user:) %>
```

Missing colon before parentheses:

```erb
<%# locals (user:) %>
```

Missing parentheses around parameters:

```erb
<%# locals: user %>
```

Empty `locals:` without parentheses:

```erb
<%# locals: %>
```

Unbalanced parentheses:

```erb
<%# locals: (user: %>
```

#### Wrong tag type (must use ERB comment tag)

Ruby comment in execution tag:

```erb
<% # locals: (user:) %>
```

#### Unsupported argument types

Positional argument (use `user:` instead):

```erb
<%# locals: (user) %>
```

Block argument:

```erb
<%# locals: (&block) %>
```

Single splat argument:

```erb
<%# locals: (*args) %>
```

Note: Double-splat (`**attributes`) IS supported for optional keyword arguments.

#### Invalid Ruby syntax

Trailing comma:

```erb
<%# locals: (user:,) %>
```

Leading comma:

```erb
<%# locals: (, user:) %>
```

Double comma:

```erb
<%# locals: (user:,, admin:) %>
```

#### Duplicate declarations

Only one `locals:` comment is allowed per partial:

```erb
<%# locals: (user:) %>
<p>Content</p>
<%# locals: (admin:) %>
```

## References

- [Action View - Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
