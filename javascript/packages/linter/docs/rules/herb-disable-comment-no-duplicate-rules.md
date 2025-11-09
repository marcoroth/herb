# Linter Rule: Disallow duplicate rule names in `herb:disable` comments

**Rule:** `herb-disable-comment-no-duplicate-rules`

## Description

Prevents listing the same rule name multiple times in a `<%# herb:disable ... %>` comment.

## Rationale

Listing a rule name more than once in a `<%# herb:disable ... %>` comment is unnecessary and likely indicates a copy-paste error or mistake. Each rule only needs to be mentioned once to be disabled.

This rule helps keep disable comments clean and prevents confusion about which rules are being disabled.

## Examples

### ✅ Good

```erb
<DIV class='value'>test</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>

<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>

<DIV>test</DIV> <%# herb:disable all %>
```

### 🚫 Bad

```erb
<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase, html-tag-name-lowercase %>

<DIV class='value'>test</DIV> <%# herb:disable html-attribute-double-quotes, html-tag-name-lowercase, html-tag-name-lowercase %>

<DIV class='value'>test</DIV> <%# herb:disable html-tag-name-lowercase, html-tag-name-lowercase, html-attribute-double-quotes, html-attribute-double-quotes %>

<DIV>test</DIV> <%# herb:disable all, all %>
```

## Fix

Remove the duplicate rule names, keeping only one instance of each:

```erb
<DIV class='value'>test</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
```

## References

\-
