---
outline: deep
---

# `ComponentTags::Visitor`

> [!WARNING]
> `ComponentTags::Visitor` is experimental and a proof of concept. The generated `render` calls, the attribute mapping, and the class itself may change or be removed without a major version bump. It prints a warning the first time it is instantiated in a process.

Rewrites capitalized tags into `render` calls, so a component can be written as a tag instead of an ERB expression.

```ruby
require "herb/engine/component_tags/visitor"

Herb::Engine.new(source, visitors: [Herb::Engine::ComponentTags::Visitor.new])
```

A tag is transformed when its name is CamelCase in every segment. `<DIV>`, `<BR>` and `<My-Component />` are left alone, since uppercase HTML tags are valid HTML.

How the tag is resolved is decided entirely from the tag name, with no lookup at compile time or at render time:

| Tag                           | Separator        | Resolves to                         |
|-------------------------------|------------------|-------------------------------------|
| `<Card />`                    | none             | `render Card.new`                   |
| `<Users::Card />`             | `::`, a constant | `render Users::Card.new`            |
| `<Users.Card />`              | `.`, a path      | `render "users/card"`               |
| `<Admin.Users.ProfileCard />` | `.`, a path      | `render "admin/users/profile_card"` |


Dot notation needs the [`dot_notation_tags`](/parser-options) parser option for the tag name to parse at all:

```ruby
Herb::Engine.new(source,
  parser_options: { dot_notation_tags: true },
  visitors: [Herb::Engine::ComponentTags::Visitor.new],
)
```

Attribute names are converted from kebab-case to snake_case and become keyword arguments:

| Attribute                  | Becomes                 | Notes                                     |
|----------------------------|-------------------------|-------------------------------------------|
| `name="hello"`             | `name: "hello"`         | Quotes, backslashes and `#{}` are escaped |
| `:count="@count"`          | `count: @count`         | A `:` prefix is used as Ruby code         |
| `name="<%= @user.name %>"` | `name: "#{@user.name}"` | ERB is interpolated into the string       |
| `disabled`                 | `disabled: true`        | An attribute without a value              |
| `item-id="7"`              | `item_id: "7"`          |                                           |

An attribute whose name isn't a valid keyword argument, such as `@click`, is skipped, and the first of a repeated attribute wins.

```html+erb
<MyComponent name="hello" :count="@count" item-id="7" />
```

Compiles to the equivalent of:

```erb
<%= render MyComponent.new(name: "hello", count: @count, item_id: "7") %>
```

For a partial, the same attributes become locals instead of keyword arguments:

```html+erb
<Users.Card name="hello" :count="@count" />
```

```erb
<%= render "users/card", name: "hello", count: @count %>
```

A tag with a body becomes a block, and the body is compiled as normal, so it can contain HTML, ERB, and further components:

```html+erb
<Card title="Hello">
  <div>Regular HTML</div>
  <%= @thing %>
  <Button>Nested component</Button>
</Card>
```

```erb
<%= render Card.new(title: "Hello") do %>
  <div>Regular HTML</div>
  <%= @thing %>
  <%= render Button.new do %>Nested component<% end %>
<% end %>
```

A partial with a body is rendered as a layout, so the body reaches the partial through `yield`:

```html+erb
<Users.Card title="Hello">Body</Users.Card>
```

```erb
<%= render layout: "users/card", locals: { title: "Hello" } do %>Body<% end %>
```
