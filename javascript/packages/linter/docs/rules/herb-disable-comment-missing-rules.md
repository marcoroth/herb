# Linter Rule: Require rule names in `herb:disable` comments

**Rule:** `herb-disable-comment-missing-rules`

## Description

Requires that `<%# herb:disable %>` comments specify either `all` or at least one specific rule name.

## Rationale

A `<%# herb:disable %>` comment without any rule names serves no purpose and likely indicates an incomplete edit or mistake. The developer either:

- Forgot to specify which rules to disable
- Intended to use `herb:disable all` but forgot to add `all`
- Started typing a comment but didn't finish

This rule ensures all `<%# herb:disable %>` comments are complete and functional.

## Examples

### ✅ Good

```erb
<DIV class='value'>test</DIV> <%# herb:disable all %>

<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>

<DIV class='value'>test</DIV> <%# herb:disable html-tag-name-lowercase, html-attribute-double-quotes %>
```

### 🚫 Bad

```erb
<div>test</div> <%# herb:disable %>

<div>test</div> <%# herb:disable   %>
```

## Fix

Add either `all` or specific rule names:

**Option 1:** Disable all rules
```erb
<DIV>test</DIV> <%# herb:disable all %>
```

**Option 2:** Disable specific rules
```erb
<DIV>test</DIV> <%# herb:disable html-tag-name-lowercase %>
```

**Option 3:** Remove the comment if it's not needed
```erb
<div>test</div>
```

## References

\-
