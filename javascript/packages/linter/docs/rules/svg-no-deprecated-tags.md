# Linter Rule: Disallow deprecated SVG tags

**Rule:** `svg-no-deprecated-tags`

## Description

Disallows SVG elements that were removed from SVG 2 and are not supported by modern browsers.

The rule covers the removed alternate-glyph elements (`altGlyph`, `altGlyphDef`, `altGlyphItem`, and `glyphRef`), `tref`, `cursor`, and the SVG Fonts elements (`font`, `glyph`, `missing-glyph`, `hkern`, `vkern`, `font-face`, `font-face-src`, `font-face-uri`, `font-face-format`, and `font-face-name`).

## Rationale

These elements belonged to earlier SVG specifications but have been removed in favor of interoperable web platform features. Use regular SVG text and `<use>` references, CSS cursors, and web fonts instead.

## Examples

### ✅ Good

```erb
<svg>
  <text x="0" y="20">Hello, SVG</text>
  <use href="#glyph" />
</svg>
```

### 🚫 Bad

```erb
<svg>
  <glyphRef xlink:href="#glyph" />
  <altGlyphDef>
    <altGlyphItem xlink:href="#glyph1" />
    <altGlyphItem xlink:href="#glyph2" />
  </altGlyphDef>
</svg>
```

## References

* [Changes from SVG 1.1 to SVG 2](https://www.w3.org/TR/SVG2/changes.html)
* [SVG element reference](https://developer.mozilla.org/en-US/docs/Web/SVG/Element)
