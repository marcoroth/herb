# Linter Rule: Navigation landmarks must have accessible labels

**Rule:** `html-navigation-has-label`

## Description

Ensure that navigation landmarks have a unique accessible name via `aria-label` or `aria-labelledby` attributes. This applies to both `<nav>` elements and elements with `role="navigation"`.

## Rationale

Navigation landmarks help users of assistive technology quickly understand and navigate to different sections of a website. When multiple navigation landmarks exist on a page, each needs a unique accessible name so users can distinguish between them (e.g., "Main navigation", "Footer links", "Breadcrumb navigation").

## Examples

### ✅ Good

```erb
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

<nav aria-labelledby="breadcrumb-title">
  <h2 id="breadcrumb-title">Breadcrumb</h2>
  <ol>
    <li><a href="/">Home</a></li>
    <li>Current Page</li>
  </ol>
</nav>

<div role="navigation" aria-label="Footer links">
  <a href="/privacy">Privacy</a>
  <a href="/terms">Terms</a>
</div>
```

### 🚫 Bad

```erb
<nav>
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/about">About</a></li>
  </ul>
</nav>

<div role="navigation">
  <a href="/privacy">Privacy</a>
  <a href="/terms">Terms</a>
</div>
```

## References

- [ARIA: `navigation` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/navigation_role)
- [HTML: `nav` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/nav)
- [ARIA: `aria-label` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-label)
- [ARIA: `aria-labelledby` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-labelledby)
- [erblint-github: GitHub::Accessibility::NavigationHasLabel](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/navigation-has-label.md)
