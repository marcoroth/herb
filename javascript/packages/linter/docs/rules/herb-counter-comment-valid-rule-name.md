# Linter Rule: Validate rule names in `herb:counter` comments

**Rule:** `herb-counter-comment-valid-rule-name`

## Description

Ensures that the rule name in every `<%# herb:counter <RuleName> ... %>` comment refers to a rule the linter actually knows about. Offers a "did you mean" suggestion via fuzzy matching when the name is close to a known rule.

## Rationale

A counter comment silently does nothing when its rule name is unknown — the linter never has offenses of that rule to suppress, and the file's real offense count never gets reflected. Validating rule names catches typos, references to removed or renamed rules, and copy-paste mistakes early, before they mask real issues.

## Examples

### ✅ Good

```erb
<%# herb:counter html-tag-name-lowercase 3 %>
```

### 🚫 Bad

```erb
<%# herb:counter this-rule-doesnt-exist 3 %>

<%# herb:counter html-tag-lowercase 3 %>
```

## References

- [`herb-counter-comment-malformed`](./herb-counter-comment-malformed.md)
- [`herb-disable-comment-valid-rule-name`](./herb-disable-comment-valid-rule-name.md)
