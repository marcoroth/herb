# Linter Rule: Disallow ERB statements inside `<script>` tags

**Rule:** `erb-no-statement-in-script`

## Description

Only insert expressions (`<%=` or `<%==`) inside `<script>` tags, never statements (`<% %>`). Statement tags inside `<script>` are likely a mistake, the author probably meant to use `<%= %>` to output a value.

## Rationale

ERB statement tags inside `<script>` tags execute Ruby code but produce no output into the JavaScript context, which is rarely intentional. If you need to interpolate a value into JavaScript, use expression tags (`<%= %>`) with `.to_json` for safe serialization. If you need conditional logic, restructure the template to keep control flow outside the `<script>` tag.

Exceptions: `<% end %>` is allowed (for closing blocks), ERB comments (`<%# %>`) are allowed, and `<script type="text/html">` allows statement tags since it contains HTML templates, not JavaScript.

## Examples

### ✅ Good

```erb
<script>
  var myValue = <%== value.to_json %>;
  if (myValue) doSomething();
</script>
```

```erb
<script type="text/template">
  <%= ui_form do %>
    <div></div>
  <% end %>
</script>
```

```erb
<script type="text/javascript">
  <%# comment %>
</script>
```

```erb
<script type="text/html">
  <% if condition %>
    <p>Content</p>
  <% end %>
</script>
```

### 🚫 Bad

```erb
<script>
  <% if value %>
    doSomething();
  <% end %>
</script>
```

```erb
<script type="text/javascript">
  <% if foo? %>
    bla
  <% end %>
</script>
```

## References

- [Shopify/better-html - `NoStatements`](https://github.com/Shopify/better-html/blob/main/lib/better_html/test_helper/safe_erb/no_statements.rb)
