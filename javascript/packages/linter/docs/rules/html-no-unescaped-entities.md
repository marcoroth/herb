# Linter Rule: Disallow unescaped HTML entities

**Rule:** `html-no-unescaped-entities`

## Description

Disallow unescaped special characters in HTML attribute values and text content. Characters like `<`, `>`, `&`, `"`, and `'` have special meaning in HTML and should be replaced with their corresponding character references when used as literal values.

This rule checks both attribute values and text content. In attribute values, all five characters are checked depending on the quote context. In text content, only bare `&` characters are flagged, since `<` and `>` are handled by the parser as tag boundaries.

ERB output tags inside attribute values are ignored, as the escaping responsibility belongs to the Ruby layer.

## Rationale

Unescaped special characters in HTML can cause parsing ambiguities, rendering issues, and security vulnerabilities. Browsers may interpret unescaped `<` and `>` as tag boundaries, leading to broken layouts or unintended element creation. Unescaped `&` characters can be misinterpreted as the start of a character reference, producing unexpected characters in the output.

Using proper character references ensures that the document is parsed correctly and consistently across all browsers.

| Character | Entity | Context |
|-----------|--------|---------|
| `<` | `&lt;` | Attribute values |
| `>` | `&gt;` | Attribute values |
| `&` | `&amp;` | Attribute values and text content |
| `"` | `&quot;` | Double-quoted attribute values |
| `'` | `&#39;` | Single-quoted attribute values |

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
<div data-char="&#x3C;&#x3E;"></div>
```

```html
<div data-html="&lt;div class=&quot;test&quot;&gt;content&lt;/div&gt;"></div>
```

```html
<div data-msg="it's fine"></div>
<div data-msg='she said "hi"'></div>
```

```erb
<div class="<%= value %>"></div>
<div data-value="prefix-<%= value %>-suffix"></div>
```

```html
<div>Tom &amp; Jerry</div>
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

## References

- [HTML Living Standard - Character references](https://html.spec.whatwg.org/multipage/syntax.html#character-references)
- [HTML Living Standard - Attributes](https://html.spec.whatwg.org/multipage/syntax.html#attributes-2)
