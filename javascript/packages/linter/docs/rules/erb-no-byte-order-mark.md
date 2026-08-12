# Linter Rule: Disallow a byte order mark at the start of a template

**Rule:** `erb-no-byte-order-mark`

## Description

Reports a UTF-8 byte order mark (`U+FEFF`, the bytes `EF BB BF`) at the very start of a template.

## Rationale

A byte order mark exists to record the endianness of UTF-16 and UTF-32 text. UTF-8 is a sequence of single bytes and has no endianness, so the mark carries no information there. Windows editors write it anyway as an encoding signature, and it survives in templates for years because it is zero width and nothing displays it.

In a template it is not metadata, it is content. ERB copies it into the response ahead of everything else, so the document starts with an invisible character before the doctype. That can push a browser into quirks mode, break code that checks whether a response begins with `<`, and show up as unexplained whitespace at the top of a page.

It also confuses tooling that pairs byte offsets with source text, because a leading `U+FEFF` is stripped by default in most UTF-8 decoders while the bytes are still counted everywhere else.

The formatter removes a leading byte order mark, so `herb format` fixes this too.

## Examples

### ✅ Good

```erb
<!DOCTYPE html>
<html></html>
```

A byte order mark that is genuinely part of the content is left alone:

```erb
<div>a﻿b</div>
```

### 🚫 Bad

```erb
﻿<!DOCTYPE html>
<html></html>
```

## References

- [Unicode FAQ: Byte Order Mark](https://www.unicode.org/faq/utf_bom.html#bom1)
- [Encoding Standard: decode](https://encoding.spec.whatwg.org/#decode)
