# Linter Rule: Prefer direct ERB output over string interpolation

**Rule:** `erb-prefer-direct-output`

## Description

Flags ERB output tags that contain a string literal, including interpolated strings. The text should be written directly in the template, and dynamic values should use separate ERB output tags.

## Rationale

Wrapping static text in a string literal inside an ERB output tag is unnecessary. The text can be written directly in the template. For interpolated strings, each dynamic value should use its own ERB output tag, which is more idiomatic, easier to read, and avoids unnecessary string allocation.

## Examples

### ✅ Good

```erb
Title
```

```erb
<%= key %>
```

```erb
<%= key %> (<%= participants.size %>)
```

```erb
Hello <%= name %>
```

### 🚫 Bad

```erb
<%= "Title" %>
```

```erb
<%= "#{key}" %>
```

```erb
<%= "#{key} (#{participants.size})" %>
```

```erb
<%= "Hello #{name}" %>
```
