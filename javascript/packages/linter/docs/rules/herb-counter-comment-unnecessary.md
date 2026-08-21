# Linter Rule: Detect unnecessary `herb:counter` comments

**Rule:** `herb-counter-comment-unnecessary`

## Description

Reports `<%# herb:counter <RuleName> ... %>` comments that no longer have any offenses of that rule left in the file to suppress. Once a file has been cleaned up, the counter should be removed.

## Rationale

Counter comments exist to baseline pre-existing offenses. Once every offense of that rule has been fixed, keeping the counter around is dead configuration — it hides the fact that the file is clean and prevents future regressions from being noticed with a clean diff.

This rule is autofixable — its autofix removes the counter comment.

## Examples

### ✅ Good

```erb
<%# herb:counter html-tag-name-lowercase 1 %>

<DIV></DIV>
```

### 🚫 Bad

```erb
<%# herb:counter html-tag-name-lowercase 3 %>

<div></div>
```

```erb
<%# herb:counter html-tag-name-lowercase 0 %>
```

## References

- [`herb-counter-comment-out-of-date`](./herb-counter-comment-out-of-date.md)
- [`herb-counter-comment-malformed`](./herb-counter-comment-malformed.md)
