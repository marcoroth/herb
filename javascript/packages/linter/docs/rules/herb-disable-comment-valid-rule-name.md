# Linter Rule: Validate rule names in `herb:disable` comments

**Rule:** `herb-disable-comment-valid-rule-name`

## Description

Ensures that all rule names specified in `<%# herb:disable ... %>` comments are valid and exist in the linter. This catches typos, references to non-existent rules and missing comma between rule names.

## Rationale

Using invalid or misspelled rule names in `<%# herb:disable ... %>` comments can lead to confusion and unexpected behavior. The comment won't disable anything if the rule name doesn't exist, leaving developers wondering why linter warnings persist.

By validating rule names, this rule helps catch typos early, identify removed or renamed rule and provide helpful suggestions for similar rule names using fuzzy matching.

## Examples

### ✅ Good

```erb
<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>

<DIV class='value'>test</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>

<DIV>test</DIV> <%# herb:disable all %>
```

### 🚫 Bad

```erb
<div>test</div> <%# herb:disable this-rule-doesnt-exist %>

<div>test</div> <%# herb:disable html-tag-lowercase %>

<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase, invalid-rule-name %>

<div>test</div> <%# herb:disable html-tag-name-lowercase html-attribute-double-quotes %>
```

## References

\-
