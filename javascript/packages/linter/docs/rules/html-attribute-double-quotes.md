# Linter Rule: Prefer double quotes for HTML Attribute values

**Rule:** `html-attribute-double-quotes`

## Description

Prefer using double quotes (`"`) around HTML attribute values instead of single quotes (`'`).

**Exception:** Single quotes are allowed when the attribute value contains double quotes, as this avoids the need for escaping.

## Rationale

Double quotes are the most widely used and expected style for HTML attributes. Consistent use of double quotes improves readability, reduces visual noise when mixing with embedded Ruby (which often uses single quotes), and avoids escaping conflicts when embedding attribute values that contain single quotes.

## Examples

### ✅ Good

```html
<input type="text" autocomplete="off">

<a href="/profile">Profile</a>

<div data-action="click->dropdown#toggle"></div>

<!-- Exception: Single quotes allowed when value contains double quotes -->
<div id='"hello"' title='Say "Hello" to the world'></div>
```


### 🚫 Bad

```html
<input type='text' autocomplete="off">

<a href='/profile'>Profile</a>

<div data-action='click->dropdown#toggle'></div>
```

## References

* [HTML Living Standard - Attributes](https://html.spec.whatwg.org/multipage/syntax.html#attributes-2)
