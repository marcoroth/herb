# Linter Rule: Detect malformed `herb:disable` comments

**Rule:** `herb-disable-comment-malformed`

## Description

Detects malformed `<%# herb:disable ... %>` comments that have syntax errors like trailing commas, leading commas, consecutive commas, or missing spaces after `herb:disable`.

## Rationale

Malformed `<%# herb:disable ... %>` comments can fail to parse correctly, leading to unexpected behavior where rules aren't actually disabled. This rule catches common syntax errors to ensure your disable comments work as intended.

## Examples

### ✅ Good

```erb
<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>

<DIV class='value'>test</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>

<DIV class='value'>test</DIV> <%# herb:disable html-tag-name-lowercase , html-attribute-double-quotes %>

<DIV>test</DIV> <%# herb:disable all %>
```

### 🚫 Bad

```erb
<div>test</div> <%# herb:disable html-tag-name-lowercase, %>

<div>test</div> <%# herb:disable , html-tag-name-lowercase %>

<div>test</div> <%# herb:disable html-tag-name-lowercase,, html-attribute-double-quotes %>

<div>test</div> <%# herb:disable html-tag-name-lowercase,, %>

<DIV>test</DIV> <%# herb:disableall %>

<DIV>test</DIV> <%# herb:disablehtml-tag-name-lowercase %>
```

## References

\-
