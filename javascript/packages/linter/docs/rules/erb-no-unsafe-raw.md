# Linter Rule: Disallow `raw()` and `.html_safe` in ERB output

**Rule:** `erb-no-unsafe-raw`

## Description

Disallow the use of `raw()` and `.html_safe` in ERB output tags. These methods bypass Rails' automatic HTML escaping, which is the primary defense against cross-site scripting (XSS) vulnerabilities.

## Rationale

Rails automatically escapes ERB output to prevent XSS. Using `raw()` or `.html_safe` disables this protection, allowing arbitrary HTML and JavaScript injection. Even when combined with other safe methods like `.to_json`, using `raw()` or `.html_safe` is still unsafe because the escaping bypass applies to the final output.

For example, `<%= raw unsafe.to_json %>` is flagged because `raw()` disables escaping on the entire expression, even though `.to_json` serializes the value safely. The `raw()` wrapper means any future changes to the expression could silently introduce a vulnerability.

Calling `.html_safe` directly on a String literal, like `<%= "<strong>Sale</strong>".html_safe %>`, is not flagged by this rule. The content is static, so there is no value that could ever carry injected input. Those cases are reported by [`actionview-no-unnecessary-html-safe`](./actionview-no-unnecessary-html-safe.md) instead, which points out that the content belongs in the template directly. Anything else, including an interpolated String like `<%= "<strong>#{name}</strong>".html_safe %>`, stays flagged here.

## Examples

### ✅ Good

```erb
<div class="<%= user_input %>"></div>
```

```erb
<p><%= user_input %></p>
```

### 🚫 Bad

```erb
<div class="<%= raw(user_input) %>"></div>
```

```erb
<div class="<%= user_input.html_safe %>"></div>
```

```erb
<p><%= raw(user_input) %></p>
```

```erb
<p><%= user_input.html_safe %></p>
```

## References

- [Shopify/better-html — TagInterpolation](https://github.com/Shopify/better-html/blob/main/lib/better_html/test_helper/safe_erb/tag_interpolation.rb)
