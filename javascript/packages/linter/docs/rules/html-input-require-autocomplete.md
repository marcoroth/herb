# Linter Rule: Require `autocomplete` attributes on `<input>` tags

**Rule:** `html-input-require-autocomplete`

## Description

Require an `autocomplete` attribute on `<input>` elements with types that support autocomplete functionality. This rule ensures that developers explicitly declare autocomplete behavior for form inputs.


## Rationale

The HTML `autocomplete` attribute helps users complete forms by using data stored in the browser. This is particularly useful for people with motor disabilities or cognitive impairment who may have difficulties filling out forms online. Without an explicit `autocomplete` attribute, behavior varies across browsers and can lead to inconsistent user experiences.

If you prefer not to specify a specific autocomplete value, use `autocomplete="on"` to enable browser defaults or `autocomplete="off"` to explicitly disable it.

## Affected Input Types

This rule applies to the following input types:

- `color`
- `date`
- `datetime-local`
- `email`
- `month`
- `number`
- `password`
- `range`
- `search`
- `tel`
- `text`
- `time`
- `url`
- `week`


## Examples

### ✅ Good

```erb
<input type="email" autocomplete="email">

<input type="url" autocomplete="off">

<input type="password" autocomplete="on">
```


### 🚫 Bad

```erb
<input type="email">

<input type="url">

<input type="password">
```

## References

* [Inspiration: ERB Lint `RequireInputAutocomplete` rule](https://github.com/shopify/erb_lint?tab=readme-ov-file#requireinputautocomplete)
* [HTML attribute: autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete)
* [WCAG: Using HTML autocomplete attributes](https://www.w3.org/WAI/WCAG21/Techniques/html/H98)
* [HTML Specification: Autofill](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill)
