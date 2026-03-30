# Linter Rule: Disallow unescaped HTML entities

**Rule:** `html-no-unescaped-entities`

## Description

Disallow unescaped special characters in HTML attribute values and text content. Characters like `<`, `>`, and `&` have special meaning in HTML and should be replaced with their corresponding character references when used as literal values.

This rule checks both attribute values and text content for unescaped `<`, `>`, and `&` characters. ERB output tags are ignored, as the escaping responsibility belongs to the Ruby layer. Only the static (literal) portions of mixed attribute values are checked.

Content inside raw text elements (`<script>` and `<style>`) is not checked, as character references are not decoded in those contexts per the HTML spec. Content inside escapable raw text elements (`<textarea>` and `<title>`) is still checked.

The `&` detection validates named references against the full HTML spec character reference list, so `&amp;`, `&lt;`, `&copy;`, etc. are recognized as valid, while `&notavalidname;` would be flagged.

## Rationale

Unescaped special characters in HTML can cause parsing ambiguities, rendering issues, and security vulnerabilities. Browsers may interpret unescaped `<` and `>` as tag boundaries, leading to broken layouts or unintended element creation. Unescaped `&` characters can be misinterpreted as the start of a character reference, producing unexpected characters in the output.

Using proper character references ensures that the document is parsed correctly and consistently across all browsers.

| Character | Entity | Context |
|-----------|--------|---------|
| `<` | `&lt;` | Attribute values and text content |
| `>` | `&gt;` | Attribute values and text content |
| `&` | `&amp;` | Attribute values and text content |

## Autofix

This rule provides an **unsafe** autofix that replaces unescaped characters with their corresponding character references. The autofix is considered unsafe because replacing characters may change the intended behavior in some contexts (e.g., URLs with query parameters).

## Examples

### ✅ Good

```html
<div class="hello"></div>
```

```html
<div data-html="&lt;br&gt;"></div>
```

```html
<a href="/path?a=1&amp;b=2">Link</a>
```

```html
<div data-char="&#60;&#62;"></div>
```

```html
<div data-char="&#x3C;&#x3E;"></div>
```

```html
<div data-html="&lt;div class=&quot;test&quot;&gt;content&lt;/div&gt;"></div>
```

```erb
<div class="<%= value %>"></div>
```

```erb
<div data-value="prefix-<%= value %>-suffix"></div>
```

```html
<div>Tom &amp; Jerry</div>
```

```html
<script>var x = a & b;</script>
```

```html
<style>.foo { content: "a & b"; }</style>
```

### 🚫 Bad

```html
<div data-html="<br>"></div>
```

```html
<div data-expr="a > b"></div>
```

```html
<a href="/path?a=1&b=2">Link</a>
```

```html
<div data-html="<b>bold & italic</b>"></div>
```

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
- [HTML Living Standard - Attributes](https://html.spec.whatwg.org/multipage/syntax.html#attributes-2)
- [HTML Living Standard - Raw text elements](https://html.spec.whatwg.org/multipage/syntax.html#raw-text-elements)
