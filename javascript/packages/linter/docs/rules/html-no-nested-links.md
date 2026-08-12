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

## Across call sites

This rule also considers where a file is rendered. When the linter runs over a whole project it resolves the HTML ancestors that each call site places a file inside, following `render` calls and each template's conventional layout `yield`.

An `<a>` at the top level of a partial is reported when every call site renders that partial inside another `<a>`.

Action View helpers that render an element count as ancestors, so a `content_tag`, `tag.div` or `link_to` block nests what it wraps just like the equivalent HTML would.

The rule stays quiet whenever there is not enough information to be sure. A file nothing renders, and a chain that never reaches a layout, are both left alone. When only some call sites nest the file, the offense is still reported and the call chain points at one that does, since the nesting is real on that code path.

Layout resolution follows Rails' naming convention and cannot see a controller declaring `layout "..."` or `layout false`.

## References

* [HTML Living Standard - The a element](https://html.spec.whatwg.org/multipage/text-level-semantics.html#the-a-element)
* [Rails `link_to` helper](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
