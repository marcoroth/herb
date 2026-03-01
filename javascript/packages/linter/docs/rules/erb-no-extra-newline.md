# Linter Rule: Disallow extra newlines

**Rule:** `erb-no-extra-newline`

## Description

Disallow more than two consecutive blank lines in ERB templates. This rule enforces a maximum of two blank lines between content to maintain consistent vertical spacing throughout your templates.

## Rationale

Excessive blank lines can make templates harder to read and maintain. While some vertical spacing improves readability by visually separating logical sections, too many blank lines create unnecessary whitespace that:

* Makes it harder to see related code on the same screen
* Creates inconsistent visual rhythm in the codebase
* Can accidentally accumulate through merge conflicts or refactoring
* Provides no additional clarity beyond what 1-2 blank lines already achieve

Limiting to two consecutive blank lines strikes a balance between allowing clear section separation while maintaining code density and readability.

## Examples

### ✅ Good

```html
line 1

line 3

<div>
  <h1>Title</h1>
</div>

<div>
  <h1>Section 1</h1>

  <p>Content here</p>
</div>

<div>
  <h1>Section 1</h1>


  <h1>Section 2</h1>
</div>
```

### 🚫 Bad

```erb
line 1



line 3

<div>
  <h1>Title</h1>



  <p>Content</p>
</div>

<%= user.name %>




<%= user.email %>
```

## References

- [Inspiration: ERB Lint `ExtraNewline` rule](https://github.com/Shopify/erb_lint/blob/main/README.md)
