# Linter Rule: Restrict allowed `type` attributes for `<script>` tags

**Rule:** `html-allowed-script-type`

## Description

Restricts which `type` attribute values are permitted on `<script>` tags. Only an approved whitelist of types is allowed: `text/javascript`. A missing `type` attribute is also reported.

## Rationale

Developers frequently use `<script>` tags with non-executable type attributes (like `application/json` or `text/html`) to embed data in pages. However, these tags share parsing quirks with executable scripts and can create security risks. For example, unescaped `</script><script>` sequences inside a `text/html` script tag could enable XSS attacks.

By restricting the allowed `type` values and requiring the `type` attribute to be present, this rule helps catch typos and discourages unsafe or unintended script usage patterns.

## Examples

### ✅ Good

```erb
<script type="text/javascript">
  console.log("Hello")
</script>
```

```erb
<script type="application/json">
  { "key": "value" }
</script>
```

```erb
<script type="text/html">
  <div>Template</div>
</script>
```

### 🚫 Bad

```erb
<script type="text/coffeescript">
  console.log "Hello"
</script>
```

```erb
<script type="application/ecmascript">
  console.log("Hello")
</script>
```

```erb
<script>
  console.log("Hello")
</script>
```

## References

- [Inspiration: ERB Lint `AllowedScriptType` rule](https://github.com/Shopify/erb_lint/tree/main?tab=readme-ov-file#allowedscripttype)
