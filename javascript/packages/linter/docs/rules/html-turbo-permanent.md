# Linter Rule: HTML Turbo permanent attribute usage

**Rule:** `html-turbo-permanent`

## Description

Ensure that `data-turbo-permanent` is used correctly on HTML elements. The `data-turbo-permanent` attribute marks elements that should persist across page navigations in Turbo Drive.

## Rationale

`data-turbo-permanent` is active whenever the attribute is present, so `data-turbo-permanent="false"` behaves the same as `data-turbo-permanent` or `data-turbo-permanent="true"`. Allowing values is misleading and should be disallowed to avoid confusion.

## Examples

### ✅ Good

```html
<div id="cart-counter" data-turbo-permanent>1 item</div>
```

### 🚫 Bad

```html
<div id="cart-counter" data-turbo-permanent="true">1 item</div>
<div id="cart-counter" data-turbo-permanent="false">1 item</div>
<div id="cart-counter" data-turbo-permanent="foo">1 item</div>
```

## References

- [Turbo: `data-turbo-permanent` attribute](https://turbo.hotwired.dev/handbook/drive#permanent-elements)
- [HTML: Boolean Attributes](https://developer.mozilla.org/en-US/docs/Glossary/Boolean/HTML)
