# Linter Rule: Validate the `herb:slots` mode

**Rule:** `herb-slots-valid-mode`

## Description

Requires the `herb:slots` directive to name at most one mode, spelled `client` or `server`.

## Rationale

The engine reads the directive's option with a permissive match and falls back to `server` when nothing matches. A misspelled mode like `clien` therefore compiles without complaint, every slot renders on the server, and the client features the author asked for never activate, with no error anywhere. The same silence covers a directive naming two modes, where the first recognized one wins.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>

<div><%= @name %></div>
```

```erb
<%# herb:slots %>

<div><%= @name %></div>
```

### 🚫 Bad

```erb
<%# herb:slots clien %>

<div><%= @name %></div>
```

```erb
<%# herb:slots client server %>

<div><%= @name %></div>
```

## References

\-
