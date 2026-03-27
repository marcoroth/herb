# Linter Rule: Disallow `<%==` in attribute values

**Rule:** `erb-no-raw-output-in-attribute-value`

## Description

ERB interpolation with `<%==` inside HTML attribute values is never safe. The `<%==` syntax bypasses HTML escaping entirely, allowing arbitrary attribute injection and XSS attacks. Use `<%=` instead to ensure proper escaping.

## Rationale

The `<%==` syntax outputs content without any HTML escaping. In an attribute value context, this means an attacker can inject a quote character to terminate the attribute, then inject arbitrary attributes including JavaScript event handlers. Even when combined with `.to_json`, using `<%==` in attributes is unsafe because it bypasses the template engine's built-in escaping that prevents attribute breakout.

## Examples

### ✅ Good

```erb
<div class="<%= user_input %>"></div>
```

### 🚫 Bad

```erb
<div class="<%== user_input %>"></div>
```

```erb
<a href="<%== unsafe %>">Link</a>
```

```erb
<a onclick="method(<%== unsafe.to_json %>)"></a>
```

## References

- [Shopify/better-html — `TagInterpolation`](https://github.com/Shopify/better-html/blob/main/lib/better_html/test_helper/safe_erb/tag_interpolation.rb)
