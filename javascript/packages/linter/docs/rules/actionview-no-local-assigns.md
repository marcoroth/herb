# Linter Rule: Prefer a strict locals declaration over `local_assigns`

**Rule:** `actionview-no-local-assigns`

## Description

Detects `local_assigns` reads in a template that has no `<%# locals: (...) %>` declaration, and suggests declaring the locals the template takes instead.

## Rationale

`local_assigns` is how a template without strict locals reads a local that a caller might not pass. It works, but it leaves the template's inputs scattered across its body, and Rails accepts any local a caller passes, including misspelled ones.

A strict locals declaration replaces those reads with one list at the top of the file. Optional locals get a default value, so `local_assigns.fetch(:alerts, [])` becomes `alerts: []` in the declaration and a plain `alerts` in the body. Rails then raises when a caller passes a local the declaration does not list, which turns a silent typo into an error at the call site.

Templates that already have a declaration are not checked. The `local_assigns` reads left in those are either redundant, which [`actionview-no-redundant-local-assigns`](./actionview-no-redundant-local-assigns.md) reports, or the few patterns a declaration cannot express. Telling an omitted local apart from one passed as `nil` with `local_assigns.key?`, and forwarding every local with `**local_assigns`, both still need `local_assigns`.

## Examples

### ✅ Good

```erb
<%# locals: (title:, alerts: []) %>

<h1><%= title %></h1>

<% alerts.each do |alert| %>
  <p><%= alert %></p>
<% end %>
```

```erb
<%# locals: (title:, size: nil) %>

<h1><%= title %></h1>

<% if local_assigns.key?(:size) %>
  <span><%= size %></span>
<% end %>
```

### 🚫 Bad

```erb
<h1><%= local_assigns[:title] %></h1>

<% local_assigns.fetch(:alerts, []).each do |alert| %>
  <p><%= alert %></p>
<% end %>
```

```erb
<%= render "row", **local_assigns %>
```

## Configuration

This rule only applies to Action View projects, so it needs `framework` to be set:

```yaml
framework: actionview
```

## References

- [Action View Overview: Strict Locals](https://guides.rubyonrails.org/action_view_overview.html#strict-locals)
- [`ActionView::Template#local_assigns`](https://api.rubyonrails.org/classes/ActionView/Template.html#method-i-local_assigns)
