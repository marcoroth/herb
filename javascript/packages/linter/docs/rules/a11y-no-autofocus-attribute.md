# Linter Rule: No `autofocus` attribute

**Rule:** `a11y-no-autofocus-attribute`

## Description

Prevent usage of the `autofocus` attribute on HTML elements.

## Rationale

The `autofocus` attribute is a global attribute that indicates an element should be focused on page load. It reduces accessibility by moving users to an element without warning and context.

Its use should be limited to form fields that serve as the main purpose of the page, such as a search input on a search page.

## Examples

### ✅ Good

```erb
<input type="text">
```

### 🚫 Bad

```erb
<input type="text" autofocus>
```

```erb
<input type="password" autofocus="autofocus">
```

## References

- [HTML: `autofocus` attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/autofocus)
- [ember-template-lint: no-autofocus-attribute](https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/no-autofocus-attribute.md)
