# Linter Rule: Restrict allowed `type` attributes for `<script>` tags

**Rule:** `html-allowed-script-type`

## Description

Restricts which `type` attribute values are permitted on `<script>` tags. Only approved types are allowed: `text/javascript`, `module`, `importmap`, `speculationrules`, and `application/ld+json`. An empty or valueless `type` attribute is reported.

## Rationale

Developers frequently use `<script>` tags with non-executable type attributes (like `application/json` or `text/html`) to embed data in pages. However, these tags share parsing quirks with executable scripts and can create security risks. For example, unescaped `</script><script>` sequences inside a `text/html` script tag could enable XSS attacks.

By restricting the allowed `type` values and requiring the `type` attribute to be present, this rule helps catch typos and discourages unsafe or unintended script usage patterns.

An exception is made for `application/ld+json`, which the HTML specification treats as an inert [data block](https://html.spec.whatwg.org/multipage/scripting.html#data-block): it is the standard mechanism for embedding JSON-LD structured data, and consumers such as search engines only recognize it inside a `<script>` element.

## Examples

### ✅ Good

```erb
<script type="text/javascript">
  console.log("Hello")
</script>
```

```erb
<script>
  console.log("Hello")
</script>
```

```erb
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Example"
  }
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
<script type="application/json">
  { "name": "Example" }
</script>
```

```erb
<script type="">
  console.log("Hello")
</script>
```

```erb
<script type>
  console.log("Hello")
</script>
```

## Options

This rule supports custom options, configured flat under the rule name in `.herb.yml`, next to the built-in keys like `enabled` and `severity`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `allowedTypes` | `string[]` | `["text/javascript", "module", "importmap", "speculationrules", "application/ld+json"]` | The `type` attribute values permitted on `<script>` tags. Replaces the default list entirely, it does not append to it. |
| `allowBlank` | `boolean` | `true` | Whether a `<script>` tag without a `type` attribute is allowed. |

```yaml [.herb.yml]
linter:
  rules:
    html-allowed-script-type:
      allowedTypes:
        - text/javascript
        - application/json
      allowBlank: false
```

Invalid option values are reported as errors and the rule falls back to its defaults for that run. See [Custom Rule Options](/configuration.md#custom-rule-options).

## References

- [Inspiration: ERB Lint `AllowedScriptType` rule](https://github.com/Shopify/erb_lint/tree/main?tab=readme-ov-file#allowedscripttype)
- [HTML specification: data blocks](https://html.spec.whatwg.org/multipage/scripting.html#data-block)
