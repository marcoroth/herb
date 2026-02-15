# Linter Rule: Disallow trailing whitespace at end of lines

**Rule:** `erb-trailing-whitespace`

## Description

Disallow trailing whitespace (spaces, tabs, carriage returns) at the end of lines in ERB templates. This rule detects and removes any invisible whitespace characters that appear after the last visible character on a line.

## Rationale

Trailing whitespace is invisible and serves no purpose, but it can cause several issues:

* Creates unnecessary noise in diffs and pull requests
* Can trigger merge conflicts when different editors handle trailing whitespace differently
* Increases file size with characters that have no visual or functional effect
* Many editor configurations and linters in other languages flag trailing whitespace, so keeping templates clean maintains consistency across the project

## Examples

### ✅ Good

```html
<div>
  <p>Hello</p>
</div>

<%= content %>

<div>
  <h1>Title</h1>
</div>
```

### 🚫 Bad

```erb
<div>···
  <p>Hello</p>··
</div>

<%= content %>·

Hello→→
World···
```

> `·` represents a trailing space, `→` represents a trailing tab.

## References

- [Inspiration: ERB Lint `TrailingWhitespace` rule](https://github.com/Shopify/erb_lint/blob/main/README.md)
