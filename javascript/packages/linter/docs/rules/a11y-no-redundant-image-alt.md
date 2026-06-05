# Linter Rule: No redundant `alt` text on `<img>` tags

**Rule:** `a11y-no-redundant-image-alt`

## Description

Enforce that `<img>` `alt` attributes do not contain the words "image" or "picture".

## Rationale

Screen readers already announce `<img>` elements as images. Including words like "image" or "picture" in the `alt` attribute is redundant and creates a repetitive experience for users relying on assistive technologies (e.g., "image, image of a sunset").

## Examples

### ✅ Good

```erb
<img src="/sunset.jpg" alt="A sunset over the ocean">
```

```erb
<img src="/logo.png" alt="Company logo">
```

```erb
<img src="/decorative.png" alt="">
```

### 🚫 Bad

```erb
<img src="/sunset.jpg" alt="image of a sunset">
```

```erb
<img src="/logo.png" alt="picture of the company logo">
```

## References

- [WCAG 2.1: Non-text Content](https://www.w3.org/WAI/WCAG22/quickref/?versions=2.1#non-text-content)
- [Deque: Alt text should not use the word "image", "picture", or "photo"](https://dequeuniversity.com/rules/axe/4.10/image-redundant-alt)
