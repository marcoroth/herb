# Linter Rule: Require head-scoped elements inside `<head>`

**Rule:** `html-head-only-elements`

## Description

Enforce that certain elements only appear inside the `<head>` section of the document.

Elements like `<title>`, `<meta>`, `<base>`, `<link>`, and `<style>` are permitted only inside the `<head>` element. They must not appear inside `<body>` or outside of `<html>`. Placing them elsewhere produces invalid HTML and relies on browser error correction.

**Exception:** `<title>` elements are allowed inside `<svg>` elements for accessibility purposes.

## Rationale

The HTML specification requires certain elements to appear only in the `<head>` section because they affect document metadata, resource loading, or global behavior:

Placing these elements outside `<head>` leads to invalid HTML and undefined behavior across browsers.


## Examples

### ✅ Good

```erb
<head>
  <title>My Page</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="/styles.css">
</head>

<body>
  <h1>Welcome</h1>
</body>
```

```erb
<head>
  <%= csrf_meta_tags %>
  <%= csp_meta_tag %>
  <%= favicon_link_tag 'favicon.ico' %>
  <%= stylesheet_link_tag "application", "data-turbo-track": "reload" %>
  <%= javascript_include_tag "application", "data-turbo-track": "reload", defer: true %>
  <title><%= content_for?(:title) ? yield(:title) : "Default Title" %></title>
</head>
```

```erb
<body>
  <svg>
    <title>Chart Title</title>
    <rect width="100" height="100"/>
  </svg>
</body>
```

### 🚫 Bad

```erb
<body>
  <title>My Page</title>

  <meta charset="UTF-8">

  <link rel="stylesheet" href="/styles.css">

  <h1>Welcome</h1>
</body>
```

```erb
<body>
  <%= csrf_meta_tags %>
  <%= csp_meta_tag %>
  <%= favicon_link_tag 'favicon.ico' %>
  <%= stylesheet_link_tag "application", "data-turbo-track": "reload" %>
  <%= javascript_include_tag "application", "data-turbo-track": "reload", defer: true %>
  <title><%= content_for?(:title) ? yield(:title) : "Default Title" %></title>
</body>
```

## References

* [HTML Living Standard - The `head` element](https://html.spec.whatwg.org/multipage/semantics.html#the-head-element)
