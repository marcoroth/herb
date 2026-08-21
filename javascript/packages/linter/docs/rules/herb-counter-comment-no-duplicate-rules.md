# Linter Rule: Disallow duplicate `herb:counter` comments for the same rule

**Rule:** `herb-counter-comment-no-duplicate-rules`

## Description

Disallows more than one `<%# herb:counter <RuleName> ... %>` comment for the same rule within the same file. If two counters for the same rule appear, only the first is honored and the linter flags every duplicate.

## Rationale

Counter comments encode an exact expected offense count for a rule in a file. Two counters for the same rule are ambiguous — the linter can't tell which count is authoritative, and users can't tell which one to update when they add or remove offenses. Keeping a single counter per rule per file keeps the intent unambiguous and the autofixes for `herb-counter-comment-out-of-date` and `herb-counter-comment-unnecessary` targeted.

## Examples

### ✅ Good

```erb
<%# herb:counter html-tag-name-lowercase 3 %>
<%# herb:counter html-attribute-double-quotes 2 %>
```

### 🚫 Bad

```erb
<%# herb:counter html-tag-name-lowercase 3 %>
<%# herb:counter html-tag-name-lowercase 4 %>
```

## References

- [`herb-counter-comment-out-of-date`](./herb-counter-comment-out-of-date.md)
- [`herb-counter-comment-unnecessary`](./herb-counter-comment-unnecessary.md)
