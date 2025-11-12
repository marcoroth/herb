# Linter Rule: Duplicate `<meta>` name attributes are not allowed

**Rule:** `html-no-duplicate-meta-names`

## Description

Warn when multiple `<meta>` tags share the same `name` or `http-equiv` attribute within the same `<head>` block, unless they are wrapped in conditional comments.

## Rationale

In HTML, duplicate `<meta>` tags with the same `name` or `http-equiv` can cause unexpected behavior. For example, search engines or social sharing tools may use the wrong value. These duplicates are often the result of copy-paste or partial rendering logic and should be avoided.

## Examples

### ✅ Good

```erb
<head>
  <meta name="description" content="Welcome to our site">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
```

```erb
<head>
  <% if mobile? %>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <% else %>
    <meta name="viewport" content="width=1024">
  <% end %>
</head>
```

### 🚫 Bad

```erb
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="viewport" content="width=1024">
</head>
```

```erb
<head>
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta http-equiv="X-UA-Compatible" content="chrome=1">
</head>
```

```erb
<head>
  <meta name="viewport" content="width=1024">

  <% if mobile? %>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <% else %>
    <meta http-equiv="refresh" content="30">  
  <% end %>
</head>
```

## References

\-
