# Linter Rule: Disallow duplicate IDs in the same document

**Rule:** `html-no-duplicate-ids`

## Description

Ensure that `id` attribute is unique within a document.

## Rationale

Duplicate IDs in an HTML document can lead to unexpected behavior, especially when using JavaScript or CSS that relies on unique identifiers. Browsers may not handle duplicate IDs consistently, which can cause issues with element selection, styling, and event handling.

## Examples

### ✅ Good

```html
<div id="header">Header</div>
<div id="main-content">Main Content</div>
<div id="footer">Footer</div>
```

```erb
<div id="<%= dom_id("header") %>">Header</div>
<div id="<%= dom_id("main_content") %>">Main Content</div>
<div id="<%= dom_id("footer") %>">Footer</div>
```

### 🚫 Bad

```html
<div id="header">Header</div>

<div id="header">Duplicate Header</div>

<div id="footer">Footer</div>
```

```erb
<div id="<%= dom_id("header") %>">Header</div>

<div id="<%= dom_id("header") %>">Duplicate Header</div>

<div id="<%= dom_id("footer") %>">Footer</div>
```

## References
* [W3 org - The id attribute](https://www.w3.org/TR/2011/WD-html5-20110525/elements.html#the-id-attribute)
* [Rails `ActionView::RecordIdentifier#dom_id`](https://api.rubyonrails.org/classes/ActionView/RecordIdentifier.html#method-i-dom_id)
