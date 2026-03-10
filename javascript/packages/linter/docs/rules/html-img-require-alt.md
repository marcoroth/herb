# Linter Rule: Require `alt` attribute on `<img>` tags

**Rule:** `html-img-require-alt`

## Description

Enforce that all `<img>` elements include an `alt` attribute.

## Rationale

The `alt` attribute provides alternative text for images, which is essential for accessibility (screen readers, assistive technologies), SEO, and proper fallback behavior when images fail to load. Even if the image is purely decorative, an empty `alt=""` should be provided to indicate that the image should be ignored by assistive technologies.

Omitting the `alt` attribute entirely leads to poor accessibility and can negatively affect user experience.

## Examples

### ✅ Good

```erb
<img src="/logo.png" alt="Company logo">

<img src="/avatar.jpg" alt="<%= user.name %>'s profile picture">

<img src="/divider.png" alt="">

<%= image_tag image_path("logo.png"), alt: "Company logo" %>
```

### 🚫 Bad

```erb
<img src="/logo.png">

<img src="/avatar.jpg" alt> <!-- TODO -->

<%= image_tag image_path("logo.png") %> <!-- TODO -->
```

## References

* [W3C: Alternative Text](https://www.w3.org/WAI/tutorials/images/)
* [WCAG 2.1: Non-text Content](https://www.w3.org/WAI/WCAG22/quickref/?versions=2.1#non-text-content)
