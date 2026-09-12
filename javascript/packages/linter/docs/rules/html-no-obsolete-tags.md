# Linter Rule: Disallow obsolete HTML tags

**Rule:** `html-no-obsolete-tags`

## Description

Disallows the elements the HTML specification lists as obsolete and non-conforming, and names the replacement for each one.

The rule covers all 29 of them: the presentational elements (`big`, `blink`, `center`, `font`, `basefont`, `marquee`, `multicol`, `nobr`, `spacer`, `strike`, `tt`), the frame elements (`frame`, `frameset`, `noframes`), the embedding elements (`applet`, `bgsound`, `keygen`, `noembed`, `param`), the preformatted text elements (`listing`, `plaintext`, `xmp`), and `acronym`, `dir`, `isindex`, `menuitem`, `nextid`, `rb`, and `rtc`.

## Rationale

These elements were removed from the specification but browsers still parse them, so a page that uses one keeps working and never signals the problem. Most of them describe presentation that belongs in a stylesheet, and the rest have a modern element or API that does the same job with better semantics.

Elements inside `<svg>` and `<math>` are left alone, because a tag name there belongs to the foreign content vocabulary and not to HTML. Deprecated SVG elements are covered by [`svg-no-deprecated-tags`](./svg-no-deprecated-tags.md).

## Examples

### ✅ Good

```erb
<p style="text-align: center">Welcome</p>
```

```erb
<abbr title="HyperText Markup Language">HTML</abbr>
```

```erb
<del>removed</del>
<s>no longer accurate</s>
```

### 🚫 Bad

```erb
<center>Welcome</center>
```

```erb
<font color="red">Warning</font>
```

```erb
<strike>no longer accurate</strike>
```

## References

* [Non-conforming features](https://html.spec.whatwg.org/multipage/obsolete.html#non-conforming-features)
