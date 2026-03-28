# Linter Rule: No ARIA on unsupported elements

**Rule:** `a11y-no-aria-unsupported-elements`

## Description

Prevent usage of ARIA roles, states, and properties on certain DOM elements that do not support them.

## Rationale

Certain HTML elements do not support ARIA roles, states, or properties because they are not visible or interactive. Adding ARIA attributes to these elements has no effect and indicates a misunderstanding of the ARIA specification.

These elements include:

- `<html>`
- `<meta>`
- `<script>`
- `<style>`

Also handles `javascript_tag` helper with `aria_label` option key.

## Examples

### ✅ Good

```erb
<meta charset="UTF-8" />
```

```erb
<html lang="en"></html>
```

```erb
<script></script>
```

```erb
<style></style>
```

```erb
<div role="button" aria-hidden="false"></div>
```

```erb
<%= javascript_tag do %>
  console.log("Hello, world!");
<% end %>
```

### 🚫 Bad

```erb
<meta charset="UTF-8" aria-hidden="false" />
```

```erb
<html lang="en" role="application"></html>
```

```erb
<script aria-hidden="false"></script>
```

```erb
<style aria-label="styles"></style>
```

```erb
<%= javascript_tag aria_label: "script block" do %>
  console.log("Hello, world!");
<% end %>
```

## References

- [WAI-ARIA Specification](https://www.w3.org/TR/wai-aria-1.2/)
- [eslint-plugin-jsx-a11y: aria-unsupported-elements](https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/blob/main/docs/rules/aria-unsupported-elements.md)
- [ember-template-lint: no-aria-unsupported-elements](https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/no-aria-unsupported-elements.md)
