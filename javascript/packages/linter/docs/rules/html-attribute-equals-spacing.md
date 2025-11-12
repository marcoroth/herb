# Linter Rule: No whitespace around `=` in HTML attributes

**Rule:** `html-attribute-equals-spacing`

## Description

Disallow whitespace before or after the equals sign (`=`) for attribute values in HTML. Attributes must follow the canonical format (`name="value"`) with no spaces between the attribute name, the equals sign, or the opening quote.

## Rationale

Extra whitespace around the `=` in HTML attribute assignments is unnecessary, inconsistent, and not idiomatic. While browsers are usually forgiving, it can lead to confusing diffs, poor formatting, or inconsistent parsing in tools.

## Examples

### ✅ Good

```erb
<div class="container"></div>
<img src="/logo.png" alt="Logo">
<input type="text" value="<%= @value %>" autocomplete="off">
```

### 🚫 Bad

```erb
<div class ="container"></div>

<img src= "/logo.png" alt="Logo">

<input  type  =  "text" autocomplete="off">
```

## References

\-
