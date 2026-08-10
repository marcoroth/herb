# Linter Rule: Require head-scoped elements inside `<head>`

**Rule:** `html-head-only-elements`

## Description

Enforce that certain elements only appear inside the `<head>` section of the document.

Elements like `<title>`, `<meta>`, `<base>`, `<link>`, and `<style>` are permitted only inside the `<head>` element. They must not appear inside `<body>` or outside of `<html>`. Placing them elsewhere produces invalid HTML and relies on browser error correction.

> [!NOTE] Exceptions
> - `<title>` elements are allowed inside `<svg>` elements for accessibility purposes.
> - `<meta>` elements with the `itemprop` attribute are allowed in the `<body>` for [microdata](https://html.spec.whatwg.org/multipage/microdata.html#the-itemprop-attribute) markup (e.g., Schema.org structured data).

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
    <rect width="100" height="100" />
  </svg>
</body>
```

```erb
<body>
  <div itemscope itemtype="https://schema.org/Book">
    <span itemprop="name">The Hobbit</span>
    <meta itemprop="author" content="J.R.R. Tolkien">
    <meta itemprop="isbn" content="978-0618260300">
  </div>
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
  <title><%= content_for?(:title) ? yield(:title) : "Default Title" %></title>
</body>
```

```erb
<body>
  <!-- Regular meta tags (name, charset, http-equiv) must be in <head> -->
  <meta name="description" content="Page description">
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="30">
</body>
```

## Across call sites

This rule also considers where a file is rendered. When the linter runs over a whole project it resolves the HTML ancestors that each call site places a file inside, following `render` calls and each template's conventional layout `yield`.

A partial holding `<meta>` or `<link>` tags is reported when every call site renders it inside `<body>`, and left alone when every call site renders it inside `<head>`.

Action View helpers that render an element count as ancestors, so a `content_tag`, `tag.div` or `link_to` block nests what it wraps just like the equivalent HTML would.

The rule stays quiet whenever there is not enough information to be sure. A file nothing renders, and a chain that never reaches a layout, are both left alone. When only some call sites place the file in the wrong section, the offense is still reported and the call chain points at one that does.

Layout resolution follows Rails' naming convention and cannot see a controller declaring `layout "..."` or `layout false`.

## References

* [HTML Living Standard - The `head` element](https://html.spec.whatwg.org/multipage/semantics.html#the-head-element)
* [MDN - The `<meta>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/meta#technical_summary)
* [HTML Living Standard - Microdata (`itemprop`)](https://html.spec.whatwg.org/multipage/microdata.html#the-itemprop-attribute)
