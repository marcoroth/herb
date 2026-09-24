# Slots <Badge type="tip" text="^0.11.0" /> <Badge type="warning" text="experimental" />

A slot is a place in the rendered page that holds something dynamic, such as an expression, a conditional, a collection or an attribute. A template compiled with slots marks each one in its output, so the browser can find it again and update only that part.

[State](/language/state), [actions](/language/actions), [keyed collections](/language/keys) and [components](/language/components) all need slots.

## `herb:slots`

Compiles the template with slots, and says who renders a branch that did not render on the first request.

```erb notwoslash
<%# herb:slots %>
<%# herb:slots server %>
<%# herb:slots client %>
```

| Mode            | A branch that did not render                                   |
|-----------------|----------------------------------------------------------------|
| `server`        | The client asks the server for its markup when it is needed    |
| `client`        | Is sent with the page and built by the client, with no request |

`<%# herb:slots %>` with no mode is `server`.

Write one directive per template, since the engine reads only the first one. The mode is spelled `server` or `client`, and a misspelled mode compiles as `server`, which the linter reports. The directive applies to the template it is in, and a partial rendered from it declares its own.

In a Rails app, ReActionView's `config.slots` sets the mode for templates without a directive. A directive always wins over the setting.

## Output

::: code-group
```erb [app/views/users/_greeting.html.erb]
<%# herb:slots client %>
<p>Hello <%= name %></p>
<% if admin %>
  <a href="/admin">Admin</a>
<% end %>
```
:::

With `name` set to `"Marco"` and `admin` false, this renders:

```html
<!--herb-region:app/views/users/_greeting.html.erb:498628c5:0-->
<p>Hello <!--herb-slot:0-->Marco<!--/herb-slot:0--></p>
<!--herb-slot:1:conditional--><!--/herb-slot:1-->
<!--/herb-region:app/views/users/_greeting.html.erb--><template data-herb-region="app/views/users/_greeting.html.erb:498628c5"><!--herb-branch:1:0-->
  <a href="/admin">Admin</a>
</template>
```

The region comments mark where one rendering of the template starts and ends. Each slot is a pair of comments, or a `data-herb-slot` attribute when the slot is the whole content of an element or an attribute value. The conditional that did not render leaves an empty pair, so its place stays addressable.

In `client` mode, the branch that did not render is parked in a `<template>`, and the client removes it from the document once it has read it.

In `server` mode the output is the same without the `<template>`.

The markers are comments and `data-` attributes, so the page renders the same with or without the [client runtime](/projects/client). The marker format may change between releases.

## Compile errors

| Cause                                                         | Message begins                                        |
|---------------------------------------------------------------|-------------------------------------------------------|
| A computed or empty `data-herb-name`                          | ``` `data-herb-name` on `<p>` is computed or empty.``` |
| Two slots in the same scope with one name                     | ``Two slots in the same scope are both named `body`.`` |
| A `data-herb-name` on an element with nothing dynamic         | ``` `data-herb-name="body"` on `<p>` names no slot``` |

## Related rules

- [`herb-slots-single-directive`](/linter/rules/herb-slots-single-directive)
- [`herb-slots-valid-mode`](/linter/rules/herb-slots-valid-mode)
- [`herb-valid-slot-names`](/linter/rules/herb-valid-slot-names)
- [`herb-state-requires-slots`](/linter/rules/herb-state-requires-slots)
- [`herb-component-requires-slots`](/linter/rules/herb-component-requires-slots)
