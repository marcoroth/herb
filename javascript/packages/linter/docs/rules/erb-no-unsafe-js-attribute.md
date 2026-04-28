# Linter Rule: Disallow unsafe ERB output in JavaScript attributes

**Rule:** `erb-no-unsafe-js-attribute`

## Description

ERB interpolation in JavaScript event handler attributes (`onclick`, `onmouseover`, etc.) must be wrapped in a safe helper such as `.to_json`, `j()`, or `escape_javascript()`. Without proper encoding, user-controlled values can break out of string literals and execute arbitrary JavaScript.

## Rationale

HTML attributes that start with `on` (like `onclick`, `onmouseover`, `onfocus`) are evaluated as JavaScript by the browser. When ERB output is interpolated into these attributes without proper encoding, it creates a JavaScript injection vector. The `.to_json` method properly serializes Ruby values into safe JavaScript literals, while `j()` and `escape_javascript()` escape values for safe embedding in JavaScript string contexts.

## Examples

### ✅ Good

```erb
<a onclick="method(<%= unsafe.to_json %>)"></a>
```

```erb
<a onclick="method('<%= j(unsafe) %>')"></a>
```

```erb
<a onclick="method(<%= escape_javascript(unsafe) %>)"></a>
```

### 🚫 Bad

```erb
<a onclick="method(<%= unsafe %>)"></a>
```

```erb
<div onmouseover="highlight('<%= element_id %>')"></div>
```

## References

- [Shopify/better-html — TagInterpolation](https://github.com/Shopify/better-html/blob/main/lib/better_html/test_helper/safe_erb/tag_interpolation.rb)
