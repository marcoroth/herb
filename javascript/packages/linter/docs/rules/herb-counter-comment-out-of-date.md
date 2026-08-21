# Linter Rule: Detect out-of-date `herb:counter` comments

**Rule:** `herb-counter-comment-out-of-date`

## Description

Reports when the count in a `<%# herb:counter <RuleName> N %>` comment no longer matches the number of offenses of that rule in the file. The count is expected to be an exact baseline, not an upper bound.

## Rationale

Counter comments are a way to "freeze" the current number of offenses of a rule in a file and drive that number down over time. When the count drifts, the counter no longer reflects reality:

- If the actual count is **higher** than `N`, the counter is silently letting new offenses in.
- If the actual count is **lower** than `N`, the counter is under-reporting progress and can hide the fact that only some offenses were actually fixed.

Reporting drift keeps counters honest. This rule is autofixable — its autofix updates `N` to the current offense count, which is what `--update-counters` runs across an entire project.

## Examples

### ✅ Good

```erb
<%# herb:counter html-tag-name-lowercase 2 %>

<DIV></DIV>
<SPAN></SPAN>
```

### 🚫 Bad

```erb
<%# herb:counter html-tag-name-lowercase 5 %>

<DIV></DIV>
```

```erb
<%# herb:counter html-tag-name-lowercase 1 %>

<DIV></DIV>
<SPAN></SPAN>
<SECTION></SECTION>
```

## References

- [`herb-counter-comment-unnecessary`](./herb-counter-comment-unnecessary.md)
- [`herb-counter-comment-malformed`](./herb-counter-comment-malformed.md)
