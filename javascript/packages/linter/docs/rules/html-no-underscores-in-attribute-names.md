# Linter Rule: No underscores on attribute names

**Rule:** `html-no-underscores-in-attribute-names`

## Description

---

Warn when an HTML attribute name contains an underscore (`_`). According to the HTML specification, attribute names should use only lowercase letters, digits, hyphens (`-`), and colons (`:`) in specific namespaces (e.g., `xlink:href` in SVG). Underscores are not valid in standard HTML attribute names and may lead to unpredictable behavior or be ignored by browsers entirely.

## Rationale

---

Underscores in attribute names violate the HTML specification and are not supported in standard markup. Their use is almost always accidental (e.g., mistyping `data-attr_name` instead of `data-attr-name`) or stems from inconsistent naming conventions across backend or templating layers.

## Examples

---

✅ Good

```html
<div data-user-id="123"></div>

<img aria-label="Close" alt="Close">

<div data-<%= key %>-attribute="value"></div>
```

🚫 Bad

```html
<div data_user_id="123"></div>

<img aria_label="Close" alt="Close">

<div data-<%= key %>_attribute="value"></div>
```

## References

---

\-
