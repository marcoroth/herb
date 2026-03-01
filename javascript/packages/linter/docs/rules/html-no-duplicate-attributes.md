# Linter Rule: Disallow duplicate attributes on the same tag

**Rule:** `html-no-duplicate-attributes`

## Description

Disallow having multiple attributes with the same name on a single HTML tag.

## Rationale

Duplicate attributes on an HTML element are invalid and may lead to undefined or unexpected behavior across browsers. When duplicate attributes exist, the browser typically uses the last occurrence, but this behavior is not guaranteed to be consistent across all engines or future specifications.

Catching duplicates early helps prevent subtle bugs, improves code correctness, and avoids accidental overwrites of attribute values.

## Examples

### ✅ Good

```erb
<input type="text" name="username" id="user-id" autocomplete="off">

<button type="submit" disabled>Submit</button>
```

### 🚫 Bad

```erb
<input type="text" type="password" name="username" autocomplete="off">

<button type="submit" type="button" disabled>Submit</button>
```

## References

* [HTML Living Standard - Attributes](https://html.spec.whatwg.org/multipage/syntax.html#attributes-2)
