# Linter Rule: No empty CSS rule in a `<style>` block

**Rule:** `html-no-empty-css-rule`

## Description

Reports a CSS rule with no declarations, such as `.card { }`, inside any `<style>` block.

## Rationale

A CSS rule with an empty body sets nothing, so it changes nothing about how the page looks. It is usually a leftover, a rule someone opened and never filled in, or one whose declarations were removed while the selector stayed. Either way it reads like a style that applies when it does nothing at all.

The rule points at the empty selector wherever it sits, in a plain `<style>` block or a `<style scoped>` one. A rule holding only a comment is left alone, since the comment is a deliberate note about what belongs there.

## Examples

### ✅ Good

```erb
<style>
  .card { padding: 1rem; }
</style>
```

### 🚫 Bad

```erb
<style>
  .card { }
</style>
```

## References

- [MDN: CSS syntax](https://developer.mozilla.org/en-US/docs/Web/CSS/Syntax)
