# Linter Rule: Always quote attribute values

**Rule:** `html-attribute-values-require-quotes`

## Description

Always wrap HTML attribute values in quotes, even when they are technically optional according to the HTML specification.

## Rationale

While some attribute values can be written without quotes if they don't contain spaces or special characters, omitting quotes makes the code harder to read, more error-prone, and inconsistent. Always quoting attribute values ensures:

- consistent appearance across all attributes,
- fewer surprises when attribute values contain special characters,
- easier editing and maintenance.

Additionally, always quoting is the common convention in most HTML formatters, linters, and developer tools.

## Examples

### ✅ Good

```html
<div id="hello"></div>

<input type="text" autocomplete="off">

<a href="/profile">Profile</a>
```

### 🚫 Bad

```html
<div id=hello></div>

<input type=text autocomplete="off">

<a href=profile></a>
```

## References

* [HTML Living Standard - Attributes](https://html.spec.whatwg.org/multipage/syntax.html#attributes-2)
