# Linter Rule: Disallow parser errors in HTML+ERB documents

**Rule:** `parser-no-errors`

## Description

Report parser errors as linting offenses. This rule surfaces syntax errors, malformed HTML, and other parsing issues that prevent the document from being correctly parsed.

## Rationale

Parser errors indicate fundamental structural problems in HTML+ERB documents that can lead to unexpected rendering behavior, accessibility issues, and maintenance difficulties. These errors should be fixed before addressing other linting concerns as they represent invalid markup that browsers may interpret inconsistently.

By surfacing parser errors through the linter, developers can catch these critical issues when running lint checks directly, without needing to switch to the language server or other tools.

## Examples

### ✅ Good

```html
<h2>Welcome to our site</h2>
<p>This is a paragraph with proper structure.</p>

<div class="container">
  <img src="image.jpg" alt="Description">
</div>
```

```erb
<h2><%= @page.title %></h2>
<p><%= @page.description %></p>

<% if user_signed_in? %>
  <div class="user-section">
    <%= current_user.name %>
  </div>
<% end %>
```

### 🚫 Bad

```html
<!-- Mismatched closing tag -->
<h2>Welcome to our site</h3>

<!-- Unclosed element -->
<div>
  <p>This paragraph is never closed
</div>

<!-- Missing opening tag -->
Some content
</div>
```

```erb
<!-- Invalid Ruby syntax in ERB -->
<%= 1 + %>

<!-- Mismatched quotes -->
<div class="container'>Content</div>

<!-- Void element with closing tag -->
<img src="image.jpg" alt="Description"></img>
```

## Error Types

This rule reports various parser error types:

- **`UNCLOSED_ELEMENT_ERROR`**: Elements that are opened but never closed
- **`MISSING_CLOSING_TAG_ERROR`**: Opening tags without matching closing tags
- **`MISSING_OPENING_TAG_ERROR`**: Closing tags without matching opening tags
- **`TAG_NAMES_MISMATCH_ERROR`**: Opening and closing tags with different names
- **`QUOTES_MISMATCH_ERROR`**: Mismatched quotation marks in attributes
- **`VOID_ELEMENT_CLOSING_TAG_ERROR`**: Void elements (like `<img>`) with closing tags
- **`RUBY_PARSE_ERROR`**: Invalid Ruby syntax within ERB tags
- **`UNEXPECTED_TOKEN_ERROR`**: Unexpected tokens during parsing
- **`UNEXPECTED_ERROR`**: Other unexpected parsing issues

## References

* [HTML Living Standard - Parsing](https://html.spec.whatwg.org/multipage/parsing.html)
* [W3C HTML Validator](https://validator.w3.org/)
* [ERB Template Guide](https://guides.rubyonrails.org/layouts_and_rendering.html)
