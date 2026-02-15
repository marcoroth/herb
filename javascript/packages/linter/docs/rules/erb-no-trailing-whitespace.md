# Linter Rule: Disallow trailing whitespace at end of lines

**Rule:** `erb-no-trailing-whitespace`

## Description

Disallow trailing whitespace (spaces, tabs, carriage returns, and other whitespace characters) at the end of lines in ERB templates.

## Skipped Content

This rule does **not** flag trailing whitespace inside:

* `<pre>` - Preformatted text where whitespace is significant
* `<textarea>` - User input where whitespace may be intentional
* `<script>` - Treated as foreign content
* `<style>` - Treated as foreign content
* ERB tags (`<% %>`, `<%= %>`, `<%# %>`) - Ruby code where trailing whitespace could be significant (heredocs, string literals)

## Rationale

Trailing whitespace is invisible and serves no purpose, but it can cause several issues:

* Creates unnecessary noise in diffs and pull requests
* Can trigger merge conflicts when different editors handle trailing whitespace differently
* Increases file size with characters that have no visual or functional effect
* Many editor configurations and linters in other languages flag trailing whitespace, so keeping templates clean maintains consistency across the project

## Examples

### ✅ Good

```erb
<div>
  <p>Hello</p>
</div>
```

```erb
<%= content %>
```

```erb
<div>
  <h1>Title</h1>
</div>
```

### 🚫 Bad

```erb
<div>···
  <p>Hello</p>
</div>
```

```erb
<%= content %>·
```

```erb
Hello→→
World···
```

> `·` represents a trailing space, `→` represents a trailing tab.

## References

- [Inspiration: ERB Lint `TrailingWhitespace` rule](https://github.com/Shopify/erb_lint/blob/main/README.md)
