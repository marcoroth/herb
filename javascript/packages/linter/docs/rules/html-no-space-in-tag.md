# Linter Rule: Enforce consistent spacing within HTML tags

**Rule:** `html-no-space-in-tag`

## Description

Enforce consistent spacing within HTML opening and closing tags. This rule ensures:
- Exactly one space between tag name and first attribute
- Exactly one space between attributes
- No extra spaces before the closing `>` in non-self-closing tags
- Exactly one space before `/>` in self-closing tags
- No whitespace in closing tags (e.g., `</div>`)
- Consistent indentation in multiline tags

## Rationale

Consistent spacing within HTML tags improves code readability and maintainability. Extra or missing spaces can make templates harder to scan and can indicate formatting inconsistencies across a codebase. This rule enforces a canonical style that is both readable and machine-parseable.

Self-closing tags (`<img />`, `<br />`) should have exactly one space before the `/>` to maintain visual consistency with HTML5 and JSX conventions.

## Examples

### ✅ Good

```erb
<div class="foo"></div>

<img src="/logo.png" alt="Logo">

<input class="foo" name="bar">

<div class="foo" data-x="bar"></div>

<div
  class="foo"
  data-x="bar"
>
  foo
</div>
```

### 🚫 Bad

```erb
<div  class="foo"></div>

<div class="foo" ></div>

<img alt="Logo" src="/logo.png">

<div class="foo"      data-x="bar"></div>

<div
   class="foo"
    data-x="bar"
>
  foo
</div>

<div >
</  div>
```

## References

- [Inspiration: ERB Lint `SpaceInHtmlTag` rule](https://github.com/shopify/erb_lint)
