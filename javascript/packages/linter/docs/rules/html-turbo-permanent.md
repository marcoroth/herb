# Linter Rule: HTML Turbo permanent attribute usage

**Rule:** `html-turbo-permanent`

## Description

Ensure that turbo permanent attributes are used correctly in HTML elements. The `data-turbo-permanent` attribute is used to mark elements that should persist across page navigations in Turbo Drive.

## Rationale

Data turbo permanent is active if the attribute is present, `data-turbo-permanent="false"` behaves the same as `data-turbo-permanent`. This should be disallowed to avoid confusion.

## Examples

### ✅ Good

```html
<div id="cart-counter" data-turbo-permanent>1 item</div>

<div id="cart-counter" data-turbo-permanent="true">1 item</div>
```

### 🚫 Bad

```html
<div id="cart-counter" data-turbo-permanent="false">1 item</div>
```

## References

* [Turbo: `data-turbo-permanent` attribute](https://turbo.hotwired.dev/handbook/drive#permanent-elements)
* [HTML: Boolean Attributes](https://developer.mozilla.org/en-US/docs/Glossary/Boolean/HTML)
