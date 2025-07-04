# Linter Rule: Enforce lowercase tag names

**Rule:** `html-tag-name-lowercase`

## Description

Enforce that all HTML tag names are written in lowercase.

## Rationale

HTML is case-insensitive for tag names, but lowercase is the widely accepted convention for writing HTML. Consistent lowercase tag names improve readability, maintain consistency across codebases, and align with the output of most HTML formatters and validators.

Writing tags in uppercase or mixed case can lead to inconsistent code and unnecessary diffs during reviews and merges.

## Examples


### ✅ Good

```erb
<div class="container"></div>

<input type="text" name="username" />

<span>Label</span>

<%= content_tag(:div, "Hello world!") %>
```

### 🚫 Bad

```erb
<DIV class="container"></DIV>

<Input type="text" name="username" />

<Span>Label</Span>

<%= content_tag(:DiV, "Hello world!") %> <!-- TODO -->
```

## References

* [HTML Living Standard - Tag Syntax](https://html.spec.whatwg.org/multipage/syntax.html#syntax-tags)
