# Linter Rule: Require client mode for `herb:state`

**Rule:** `herb-state-requires-client-mode`

## Description

Requires a template that declares `herb:state` to also opt into client-mode slots with `<%# herb:slots client %>`.

## Rationale

A declared state only works when the branches it drives are parked for the client, and parking happens in client mode. In server mode the template renders normally, every action attribute wires up, and then nothing ever changes on screen, with no error anywhere. The runtime reports `herb-no-parked-branch` when debug mode is on, but statically this is a one-line fix the editor can point at directly.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>
<%# herb:state (open: false) %>

<button data-herb-toggle="open">Details</button>
<% if open? %><nav>Menu</nav><% end %>
```

### 🚫 Bad

```erb
<%# herb:state (open: false) %>

<button data-herb-toggle="open">Details</button>
<% if open? %><nav>Menu</nav><% end %>
```

## References

\-
