# Linter Rule: Disallow `javascript_tag` helper

**Rule:** `erb-no-javascript-tag-helper`

## Description

The `javascript_tag do` helper syntax is deprecated. Use inline `<script>` tags instead, which allows the linter to properly analyze ERB output within JavaScript.

## Rationale

The `javascript_tag` helper renders its block as raw text, which means unsafe ERB interpolation inside it cannot be detected by other safety rules like `erb-no-unsafe-script-interpolation` or `erb-no-statement-in-script`. By using inline `<script>` tags instead, the linter can properly parse and validate that Ruby data is safely serialized with `.to_json` before being interpolated into JavaScript.

## Examples

### ✅ Good

```erb
<script>
  if (a < 1) { alert("hello") }
</script>
```

### 🚫 Bad

```erb
<%= javascript_tag do %>
  if (a < 1) { <%= unsafe %> }
<% end %>
```

## References

- [Shopify/better-html — `NoJavascriptTagHelper`](https://github.com/Shopify/better-html/blob/main/lib/better_html/test_helper/safe_erb/no_javascript_tag_helper.rb)
