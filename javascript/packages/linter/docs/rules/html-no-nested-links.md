# Linter Rule: Disallow nested links

**Rule:** `html-no-nested-links`

## Description

Disallow placing one `<a>` element inside another `<a>` element. Links must not contain other links as descendants.

## Rationale

The HTML specification forbids nesting one anchor (`<a>`) inside another. Nested links result in invalid HTML, unpredictable click behavior, and inconsistent rendering across browsers.

Browsers may attempt error recovery when encountering nested links, but behavior varies and cannot be relied upon. This rule ensures strictly valid document structure and avoids subtle user interaction issues.

## Examples

### ✅ Good

```erb
<a href="/products">View products</a>
<a href="/about">About us</a>

<%= link_to "View products", products_path %>
<%= link_to about_path do %>
  About us
<% end %>
```

### 🚫 Bad

```erb
<a href="/products">
  View <a href="/special-offer">special offer</a>
</a>

<%= link_to "Products", products_path do %>
  <%= link_to "Special offer", offer_path %> <!-- TODO -->
<% end %>
```

## References

* [HTML Living Standard - The a element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element)
* [Rails `link_to` helper](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
