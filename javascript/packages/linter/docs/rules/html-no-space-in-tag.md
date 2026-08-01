# Linter Rule: Enforce consistent spacing within HTML tags

**Rule:** `html-no-space-in-tag`

## Description

Enforce consistent spacing within HTML opening and closing tags. This rule ensures:
- Exactly one space between the tag name and the first attribute on the same line
- Exactly one space between attributes on the same line
- No extra spaces before the closing `>` in non-self-closing tags
- Exactly one space before `/>` in self-closing tags
- No whitespace in closing tags (e.g., `</div>`)
- No blank lines inside a multiline tag
- The closing `>`/`/>`, when placed on its own line, aligned with the opening tag

The indentation of attribute lines in a multiline tag is intentionally **not** enforced by this rule — attributes may be aligned or hanging-indented as you prefer, and normalizing indentation is left to the formatter.

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

<div class="foo"
     data-x="bar">
  foo
</div>
```

### 🚫 Bad

```erb
<div  class="foo"></div>

<div class="foo" ></div>

<div class="foo"      data-x="bar"></div>

<div

  class="foo"
>
  foo
</div>

<div
  class="foo"
  >
  foo
</div>

<div >
</  div>
```

## References

- [Inspiration: ERB Lint `SpaceInHtmlTag` rule](https://github.com/shopify/erb_lint)
