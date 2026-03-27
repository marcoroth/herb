# Linter Rule: Require nonce attribute on script tags and helpers

**Rule:** `html-require-script-nonce`

## Description

Require a `nonce` attribute on inline `<script>` tags, Rails JavaScript helper methods (`javascript_tag`, `javascript_include_tag`) and tag helpers (`tag.script`). This helps enforce a Content Security Policy (CSP) that mitigates cross-site scripting (XSS) attacks.

## Rationale

A Content Security Policy with a nonce-based approach ensures that only scripts with a valid, server-generated nonce are executed by the browser. Without a nonce, inline scripts and dynamically included scripts may be blocked by CSP, or worse, CSP may need to be relaxed with `unsafe-inline`, defeating its purpose.

Adding `nonce` attributes to all script tags and helpers ensures:

- Scripts are allowed by the CSP without weakening it
- Protection against XSS attacks that attempt to inject unauthorized scripts
- Consistent security practices across the codebase

## Examples

### ✅ Good

HTML script tags with a nonce:

```erb
<script nonce="<%= request.content_security_policy_nonce %>">
  alert("Hello, world!")
</script>
```

```erb
<script type="text/javascript" nonce="<%= request.content_security_policy_nonce %>">
  console.log("Hello")
</script>
```

Rails helpers with `nonce: true`:

```erb
<%= javascript_tag nonce: true do %>
  alert("Hello, world!")
<% end %>
```

```erb
<%= javascript_include_tag "application", nonce: true %>
```

```erb
<%= tag.script nonce: true do %>
  alert("Hello, world!")
<% end %>
```

Non-JavaScript script types (not flagged):

```erb
<script type="application/json">
  {"key": "value"}
</script>
```

```erb
<script type="application/ld+json">
  {"@context": "https://schema.org"}
</script>
```

### 🚫 Bad

HTML script tags without a nonce:

```erb
<script>
  alert("Hello, world!")
</script>
```

```erb
<script type="text/javascript">
  console.log("Hello")
</script>
```

Rails helpers without `nonce: true`:

```erb
<%= javascript_tag do %>
  alert("Hello, world!")
<% end %>
```

```erb
<%= javascript_include_tag "application" %>
```

```erb
<%= tag.script do %>
  alert("Hello, world!")
<% end %>
```

## References

- [Inspiration: ERB Lint `RequireScriptNonce` rule](https://github.com/Shopify/erb_lint/blob/main/lib/erb_lint/linters/require_script_nonce.rb)
- [MDN: Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Rails: `content_security_policy_nonce`](https://api.rubyonrails.org/classes/ActionDispatch/ContentSecurityPolicy/Request.html)
