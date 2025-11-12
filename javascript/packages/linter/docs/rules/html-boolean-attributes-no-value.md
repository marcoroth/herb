# Linter Rule: Omit values for boolean attributes

**Rule:** `html-boolean-attributes-no-value`

## Description

Omit attribute values for boolean HTML attributes. For boolean attributes, their presence alone represents `true`, and their absence represents `false`. There is no need to assign a value or use quotes.

## Rationale

Using the canonical form for boolean attributes improves readability, keeps HTML concise, and avoids unnecessary characters. This also matches HTML specifications and the output of many HTML formatters.

For example, instead of writing `disabled="disabled"` or `disabled="true"`, simply write `disabled`.

## Examples

### ✅ Good

```html
<input type="checkbox" checked>

<button disabled>Submit</button>

<select multiple></select>
```

### 🚫 Bad

```html
<input type="checkbox" checked="checked">

<button disabled="true">Submit</button>

<select multiple="multiple"></select>
```

## References

* [HTML Living Standard - Boolean Attributes](https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#boolean-attributes)
