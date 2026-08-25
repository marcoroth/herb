# Linter Rule: Disallow literal non-breaking spaces

**Rule:** `html-no-literal-nbsp`

## Description

Reports a literal non-breaking space (`U+00A0`, the bytes `C2 A0`) in text content or in an attribute value, and replaces it with `&nbsp;`.

## Rationale

A non-breaking space renders the same whether it is written as the raw character or as `&nbsp;`, so this is about the source rather than the page. The raw character is indistinguishable from an ordinary space in an editor, a diff, or a code review, which makes it easy to introduce by accident and impossible to spot on purpose. Most of them arrive by pasting from a word processor or a browser rather than by choice.

Being invisible also makes it fragile. Tooling that treats it as whitespace can drop it silently, and nothing in the diff explains where the spacing went.

`&nbsp;` says exactly what is meant, survives every editor, and is the form the rest of the document already uses for characters that cannot be typed safely.

The rule does not look inside `<script>` or `<style>`, because character references are not decoded there and `&nbsp;` would end up in the JavaScript or CSS as literal text. It also does not look inside ERB tags, where the character is part of the Ruby source.

## Examples

### ✅ Good

```erb
<p>10&nbsp;kg</p>
```

```erb
<div title="Dr.&nbsp;Smith">Profile</div>
```

### 🚫 Bad

```erb
<p>10 kg</p>
```

```erb
<div title="Dr. Smith">Profile</div>
```

### Notes

::: tip Both bad examples contain a raw `U+00A0`
They look identical to the good ones in a browser and in most editors. That is the point of the rule.
:::

## References

- [HTML Standard: named character references](https://html.spec.whatwg.org/multipage/named-characters.html)
- [Unicode: NO-BREAK SPACE (U+00A0)](https://www.compart.com/en/unicode/U+00A0)
