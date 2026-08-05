# Linter Rule: Disallow duplicate IDs in the same document

**Rule:** `html-no-duplicate-ids`

## Description

Ensure that `id` attribute is unique within a document.

## Rationale

Duplicate IDs in an HTML document can lead to unexpected behavior, especially when using JavaScript or CSS that relies on unique identifiers. Browsers may not handle duplicate IDs consistently, which can cause issues with element selection, styling, and event handling.

## Examples

### ✅ Good

```html
<div id="header">Header</div>
<div id="main-content">Main Content</div>
<div id="footer">Footer</div>
```

```erb
<div id="<%= dom_id("header") %>">Header</div>
<div id="<%= dom_id("main_content") %>">Main Content</div>
<div id="<%= dom_id("footer") %>">Footer</div>
```

### 🚫 Bad

```html
<div id="header">Header</div>

<div id="header">Duplicate Header</div>

<div id="footer">Footer</div>
```

## Static vs. dynamic IDs

The severity of an offense depends on whether the `id` can be proven to collide:

- **Static IDs** (e.g. `id="header"`) use the rule's configured `severity` (default `error`), two identical static IDs are unconditionally a duplicate.
- **Dynamic IDs** (containing an ERB output expression, e.g. `id="<%= dom_id(record) %>"`) are always reported as **hints**, phrased as a *potential* duplicate, regardless of the rule's configured severity.

A dynamic ID can never be statically proven to collide: the same source expression can evaluate to different values (a non-idempotent method, a counter, a value reassigned between outputs), so an error would overclaim certainty. Because of this, reusing the same loop variable across separate blocks is **not** flagged at all:

```erb
<% good.each do |i| %>
  <p id="<%= i %>"><%= i %></p>
<% end %>

<% bad.each do |i| %>
  <p id="<%= i %>"><%= i %></p>
<% end %>
```

The same dynamic expression repeated within the same scope (same document level, same conditional branch) is surfaced as a hint rather than an error:

```erb
<div id="<%= dom_id("header") %>">Header</div>

<div id="<%= dom_id("header") %>">Potential duplicate Header</div>
```

Hints do not fail a lint run unless you opt in with `failLevel: hint` (or `--fail-level hint`), which is how you enforce potential duplicates in CI when you know your IDs are deterministic.

Ruby interpolation inside an Action View helper attribute counts as dynamic in exactly the same way, so these two IDs are compared as `#{event["name"]}-pending` and `#{talk["title"]}-pending` rather than as the shared literal `-pending`:

```erb
<%= link_to event["url"], id: "#{event["name"]}-pending" do %>
  <%= event["name"] %>
<% end %>

<%= link_to talk["url"], id: "#{talk["title"]}-pending" do %>
  <%= talk["title"] %>
<% end %>
```

## `<template>` elements

A `<template>` is an inert document fragment — its contents only enter the document once the template is cloned/inflated. Each `<template>` body therefore gets its **own ID context**: IDs inside it don't compete with IDs elsewhere in the document, or with IDs in other templates.

```erb
<div id="thing">Rendered on load</div>

<template id="thing-template">
  <div id="thing"></div>
</template>
```

Two things are still reported:

- **Duplicates within the same template.** Cloning a template materializes all of its contents at once, so IDs repeated inside one template are a genuine collision:

  ```erb
  <template>
    <div id="thing">One</div>
    <div id="thing">Two</div> <%# Duplicate ID `thing` %>
  </template>
  ```

- **The template element's own `id`.** `thing-template` above lives in the surrounding document, so duplicates between template elements — or between a template element and an outside element — are reported as usual.

## References
* [W3 org - The id attribute](https://www.w3.org/TR/2011/WD-html5-20110525/elements.html#the-id-attribute)
* [Rails `ActionView::RecordIdentifier#dom_id`](https://api.rubyonrails.org/classes/ActionView/RecordIdentifier.html#method-i-dom_id)
