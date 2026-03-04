# Linter Rule: Detect unnecessary `herb:disable` comments

**Rule:** `herb-disable-comment-unnecessary`

## Description

Warns when a `<%# herb:disable ... %>` comment doesn't actually suppress any linter offenses on that line, indicating it's unnecessary and should be removed.

## Rationale

Unnecessary `<%# herb:disable ... %>` comments create noise in the codebase and can mislead developers about which rules are being suppressed. These comments often remain after the code has been refactored and no longer triggers the offense.

Removing unnecessary disable comments keeps the codebase clean and ensures that suppression comments accurately reflect actual rule violations being intentionally ignored.

## Examples

### ✅ Good

```erb
<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>

<DIV id='test-1'>content</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>

<DIV id='test-2'>content</DIV> <%# herb:disable all %>
```

### 🚫 Bad

```erb
<div>test</div> <%# herb:disable html-tag-name-lowercase %>

<div id="test">content</div> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>

<div id="test-1">content</div> <%# herb:disable all %>

<DIV id='test-2'>content</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes, html-no-empty-headings %>

<div>test</div> <%# herb:disableall %>
```


## References

\-
