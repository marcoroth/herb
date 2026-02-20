# Linter Rule: Disallow consecutive comments

**Rule:** `html-no-consecutive-comments`

## Description

Disallow more than two consecutive comment nodes in ERB templates. This rule flags groups of three or more adjacent HTML comments (`<!-- -->`) or ERB comments (`<%# %>`) that could be condensed into fewer comments.

Both HTML and ERB comments are counted together. Mixed groups of HTML and ERB comments are treated as a single consecutive chain.

Whitespace-only lines between comments do not break the consecutive chain. The rule checks comments at each level of nesting independently, so comments at the document root and comments inside elements are evaluated separately.

Functional directive comments such as `herb:disable` and `herb:enable` are not counted toward the consecutive limit, since they serve a specific purpose and are not regular documentation comments.

## Rationale

Multiple consecutive comments often indicate that separate comments could be merged into a single, more descriptive comment. Excessive comment fragmentation creates visual noise that reduces readability and makes it harder to distinguish meaningful comments from clutter. These fragments can accumulate over time through incremental edits or copy-paste and are usually better expressed as a single block comment explaining the broader context.

Condensing related comments into one cohesive comment improves clarity and keeps templates concise.

## Examples

### ✅ Good

```html
<!-- Navigation section with responsive breakpoints -->
<nav class="main-nav">
  <ul>
    <li><a href="/">Home</a></li>
  </ul>
</nav>
```

```erb
<%# User profile section %>
<div class="profile">
  <!-- Avatar -->
  <img src="<%= user.avatar_url %>" alt="<%= user.name %>">

  <!-- Details -->
  <h2><%= user.name %></h2>
</div>
```

Two consecutive comments are allowed:

```html
<!-- TODO: Add error handling -->
<!-- See: https://example.com/docs -->
<div class="widget">
  <p>Content</p>
</div>
```

### 🚫 Bad

```html
<!-- Navigation -->
<!-- Main navigation bar -->
<!-- Contains links to all pages -->
<nav class="main-nav">
  <ul>
    <li><a href="/">Home</a></li>
  </ul>
</nav>
```

```erb
<%# User profile %>
<%# Shows user info %>
<%# Including avatar %>
<div class="profile">
  <h2><%= user.name %></h2>
</div>
```

Mixed HTML and ERB comments also count:

```erb
<!-- Section start -->
<%# Renders the header %>
<!-- Header component -->
<header>
  <h1><%= title %></h1>
</header>
```

## References

- [Inspiration: haml-lint `ConsecutiveComments` rule](https://github.com/sds/haml-lint/blob/main/lib/haml_lint/linter/consecutive_comments.rb)
