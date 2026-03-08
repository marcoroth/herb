# Linter Rule: Disallow unsafe ERB output inside `<script>` tags

**Rule:** `erb-no-unsafe-script-interpolation`

## Description

ERB interpolation in `<script>` tags must call `.to_json` to safely serialize Ruby data into JavaScript. Without `.to_json`, user-controlled values can break out of string literals and execute arbitrary JavaScript.

## Rationale

The main goal of this rule is to assert that Ruby data translates into JavaScript data, but never becomes JavaScript code. ERB output inside `<script>` tags is interpolated directly into the JavaScript context. Without proper serialization via `.to_json`, an attacker can inject arbitrary JavaScript by manipulating the interpolated value.

For example, consider:

```erb
<script>
  var name = "<%= user.name %>";
</script>
```

If `user.name` contains `"; alert(1); "`, the resulting JavaScript would execute arbitrary code. Using `.to_json` properly escapes the value and wraps it in quotes:

```erb
<script>
  var name = <%= user.name.to_json %>;
</script>
```

## Examples

### ✅ Good

```erb
<script>
  var name = <%= user.name.to_json %>;
</script>
```

```erb
<script>
  var data = <%== config.to_json %>;
</script>
```

```erb
<script>
  <%= raw unsafe.to_json %>
</script>
```

### 🚫 Bad

```erb
<script>
  var name = "<%= user.name %>";
</script>
```

```erb
<script>
  if (a < 1) { <%= unsafe %> }
</script>
```

```erb
<script>
  <%= @feature.html_safe %>
</script>
```

## References

- [Shopify/better-html — ScriptInterpolation](https://github.com/Shopify/better-html/blob/main/lib/better_html/test_helper/safe_erb/script_interpolation.rb)
