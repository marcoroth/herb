# Linter Rule: Disallow unsafe ERB output inside `<script>` tags

**Rule:** `erb-no-unsafe-script-interpolation`

## Description

ERB interpolation in `<script>` tags must use `.to_json` to safely serialize Ruby data into JavaScript. Without `.to_json`, user-controlled values can break out of string literals and execute arbitrary JavaScript.

This rule also detects usage of `j()` and `escape_javascript()` inside `<script>` tags and recommends `.to_json` instead, because `j()` is only safe when the output is placed inside quoted string literals, a subtle requirement that is easy to get wrong.

## Rationale

The main goal of this rule is to assert that Ruby data translates into JavaScript data, but never becomes JavaScript code. ERB output inside `<script>` tags is interpolated directly into the JavaScript context. Without proper serialization, an attacker can inject arbitrary JavaScript by manipulating the interpolated value.

For example, consider:

```erb
<script>
  var name = "<%= user.name %>";
</script>
```

If `user.name` contains `"; alert(1); "`, it renders as:

```html
<script>
  var name = ""; alert(1); "";
</script>
```

This is a Cross-Site Scripting (XSS) vulnerability, as the attacker breaks out of the string literal and executes arbitrary JavaScript.

Using `.to_json` properly escapes the value and wraps it in quotes:

```erb
<script>
  var name = <%= user.name.to_json %>;
</script>
```

With the same malicious input `"; alert(1); "`, `.to_json` safely renders:

```html
<script>
  var name = "\"; alert(1); \"";
</script>
```

The value stays contained as a string, and no code is executed.

### Why not `j()` or `escape_javascript()`?

`j()` escapes characters special inside JavaScript string literals (quotes, newlines, etc.), but it does **not** produce a quoted value. This means it's only safe when wrapped in quotes.

This works, but is fragile. In this example safety depends on the surrounding quotes:
```erb
<script>
  var name = '<%= j user.name %>';
</script>
```

Without quotes, `j()` provides no protection and is **UNSAFE**, so code can still be injected:

```erb
<script>
  var name = <%= j user.name %>;
</script>
```

If `user.name` is `alert(1)`, `j()` passes it through unchanged (no special characters to escape), rendering:

```html
<script>
  var name = alert(1);
</script>
```

This results in a Cross-Site Scripting (XSS) vulnerability, as the attacker-controlled value is interpreted as JavaScript code rather than a string/data.

`.to_json` is safe in any position because it always produces a valid, quoted JavaScript value.

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

### ⚠️ Prefer `.to_json` over `j()` / `escape_javascript()`

```diff
- const url = '<%= j @my_path %>';
+ const url = <%= @my_path.to_json %>;
```

```diff
- const name = '<%= escape_javascript(user.name) %>';
+ const name = <%= user.name.to_json %>;
```

## References

- [Shopify/better-html — ScriptInterpolation](https://github.com/Shopify/better-html/blob/main/lib/better_html/test_helper/safe_erb/script_interpolation.rb)
- [`escape_javascript` / `j`](https://api.rubyonrails.org/classes/ActionView/Helpers/JavaScriptHelper.html#method-i-escape_javascript)
- [`json_escape`](https://api.rubyonrails.org/classes/ERB/Util.html#method-c-json_escape)
