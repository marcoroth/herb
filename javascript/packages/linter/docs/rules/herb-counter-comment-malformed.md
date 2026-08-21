# Linter Rule: Detect malformed `herb:counter` comments

**Rule:** `herb-counter-comment-malformed`

## Description

Detects `<%# herb:counter ... %>` comments that don't match the expected shape. Every counter comment must be `herb:counter <RuleName> <count>` where `<count>` is a non-negative integer and no extra content follows.

## Rationale

Counter comments baseline how many offenses of a specific rule a file is allowed to have. If the comment is malformed the linter can't tell what to suppress, so it flags the counter itself instead of silently ignoring it.

## Examples

### ✅ Good

```erb
<%# herb:counter html-tag-name-lowercase 3 %>

<%# herb:counter html-tag-name-lowercase 0 %>
```

### 🚫 Bad

```erb
<%# herb:counter html-tag-name-lowercase %>

<%# herb:counter html-tag-name-lowercase three %>

<%# herb:counter html-tag-name-lowercase -1 %>

<%# herb:counter html-tag-name-lowercase 3 extra %>
```

## References

- [`herb-counter-comment-valid-rule-name`](./herb-counter-comment-valid-rule-name.md)
- [`herb-counter-comment-out-of-date`](./herb-counter-comment-out-of-date.md)
- [`herb-counter-comment-unnecessary`](./herb-counter-comment-unnecessary.md)
