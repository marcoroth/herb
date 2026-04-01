# Linter Rule: Disallow unescaped HTML entities

**Rule:** `html-no-unescaped-entities`

## Description

Disallow unescaped special characters in HTML text content. Characters like `<`, `>`, and `&` have special meaning in HTML and should be replaced with their corresponding character references when used as literal text content.

This rule only checks text content. Attribute values are not checked, as the HTML5 spec (§13.2.5.36, §13.2.5.37) permits all characters in quoted attribute values without parse errors.

Content inside raw text elements (`<script>` and `<style>`) is not checked, as character references are not decoded in those contexts per the HTML spec. Content inside escapable raw text elements (`<textarea>` and `<title>`) is still checked.

The `&` detection validates named references against the full HTML spec character reference list, so `&amp;`, `&lt;`, `&copy;`, etc. are recognized as valid, while `&notavalidname;` would be flagged.

## Rationale

Unescaped special characters in HTML text content can cause parsing ambiguities, rendering issues, and security vulnerabilities. Browsers may interpret unescaped `<` and `>` as tag boundaries, leading to broken layouts or unintended element creation. Unescaped `&` characters can be misinterpreted as the start of a character reference, producing unexpected characters in the output.

Using proper character references ensures that the document is parsed correctly and consistently across all browsers.

| Character | Entity  | Context      |
|-----------|---------|--------------|
| `<`       | `&lt;`  | Text content |
| `>`       | `&gt;`  | Text content |
| `&`       | `&amp;` | Text content |

## Autofix

This rule provides an **unsafe** autofix that replaces unescaped characters with their corresponding character references. The autofix is considered unsafe because replacing characters may change the intended behavior in some contexts.

## Examples

### ✅ Good

```html
<div>Tom &amp; Jerry</div>
```

```html
<div data-action="click->controller#method"></div>
```

```html
<div class="[&>p:not(:first-of-type)]:pt-4"></div>
```

```html
<a href="/path?a=1&b=2">Link</a>
```

```html
<div data-html="<br>"></div>
```

```erb
<div class="<%= value %>"></div>
```

```html
<script>var x = a & b;</script>
```

```html
<style>.foo { content: "a & b"; }</style>
```

### 🚫 Bad

```html
<div>Tom & Jerry</div>
```

```html
<p>Hello this is < content</p>
```

```html
<p>a > b</p>
```

## References

- [HTML Living Standard - Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)
- [HTML Living Standard - Attribute value (double-quoted) state](https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(double-quoted)-state)
- [HTML Living Standard - Attribute value (single-quoted) state](https://html.spec.whatwg.org/multipage/parsing.html#attribute-value-(single-quoted)-state)
- [HTML Living Standard - Raw text elements](https://html.spec.whatwg.org/multipage/syntax.html#raw-text-elements)
