# Linter Rule: Disallow unused `herb:state` declarations

**Rule:** `herb-state-no-unused-states`

## Description

Flags a declared state that is never read by the template and never written by an action attribute or a bound form control.

## Rationale

Every declared state travels in the template's schema and dependency map, so a state nothing uses is payload and parked markup for nothing. It is usually a leftover from a refactor or a typo, since a misspelled read no longer matches the declaration.

A state can legitimately be driven only from app code, through `stateFor` or `useState`. The rule cannot see JavaScript, so that case is a false positive by design. Disable the line with a `herb:disable` comment, and the offense message says so.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (open: false, attempts: 0) %>

<button data-herb-toggle="open">Details</button>
<p><%= attempts %></p>
```

### 🚫 Bad

```erb
<%# herb:slots client %>
<%# herb:state (open: false, stale: true) %>

<% if open? %>Open<% end %>
```

## References

\-
