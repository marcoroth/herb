# Linter Rule: No `aria-hidden` on `<body>`

**Rule:** `html-no-aria-hidden-on-body`

## Description

Prevent usage of `aria-hidden` on `<body>` tags.

## Rationale

The `aria-hidden` attribute should never be present on the `<body>` element, as it hides the entire document from assistive technology users. This makes the entire page completely inaccessible to screen reader users, which is a critical accessibility violation.

## Examples

### ✅ Good

```erb
<body>
  <main>Content</main>
</body>

<body class="app" id="main">
  <main>Content</main>
</body>
```

### 🚫 Bad

```erb
<body aria-hidden>
  <main>Content</main>
</body>

<body aria-hidden="true">
  <main>Content</main>
</body>
```

## References

- [Using the aria-hidden attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Techniques/Using_the_aria-hidden_attribute)
- [How Lighthouse identifies hidden body elements](https://web.dev/aria-hidden-body/)
- [WCAG 4.1.2 - Name, Role, Value (Level A)](https://www.w3.org/TR/WCAG21/#name-role-value)
- [ember-template-lint: no-aria-hidden-body](https://github.com/ember-template-lint/ember-template-lint/blob/main/docs/rule/no-aria-hidden-body.md)
