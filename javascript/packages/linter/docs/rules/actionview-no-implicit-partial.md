# Linter Rule: Disallow `render` calls that infer the partial from an object

**Rule:** `actionview-no-implicit-partial`

## Description

Detects `render` calls that pass an object or collection without naming a partial, such as `render @products`, where Rails derives the template name from the class of each item.

## Rationale

`render @products` renders `_product.html.erb` once per item, choosing the template from each item's class at runtime. Nothing in the call says so:

```erb
<%= render @products %>
```

Naming the partial says it:

```erb
<%= render partial: "products/product", collection: @products %>
```

The implicit form is compact and idiomatic, and it costs the same things every unnamed dependency costs. Searching for the templates that render `_product.html.erb` misses these calls. Changing or subclassing the model changes which template renders, silently.

Naming the partial also turns the call into an edge Herb can follow. Once the template is written down it matches an entry in the partial index, and the language server can jump from the call to the partial and back to every caller, rename a strict local across all of those call sites at once, complete the locals the partial declares as you type them, and report a call that passes a local the partial does not declare or omits one it requires. A derived name matches no entry, which is why the language server says the same thing when you ask it to jump to a partial it cannot resolve.

The implicit form is common Rails, so this reports at `info`: it is guidance for codebases that want template dependencies written down rather than derived, not a defect report.

### Notes

::: tip Component renders are not reported
`render FlashComponent.new(...)` and `render Primer::Alpha::Banner.new(...)` call `render_in` on the object rather than looking up a partial, so there is no partial name to write. Any render whose object is built from a constant is left alone, and so is any render whose call chain constructs an object with `.new`, which covers the factory helpers component libraries use: `render component("ui/modal").new(title: t(".title"))`.
:::

Renders that name a partial, including with a dynamic name, are not reported here. See [`actionview-no-dynamic-partial-path`](./actionview-no-dynamic-partial-path.md).

Only output tags are reported. A `render` in a silent `<% %>` tag discards its output and is covered by [`actionview-no-silent-render`](./actionview-no-silent-render.md).

## Examples

### ✅ Good

```erb
<%= render partial: "products/product", collection: @products %>
```

```erb
<%= render @products, partial: "product" %>
```

```erb
<%= render partial: "products/product", object: @product %>
```

### 🚫 Bad

```erb
<%= render @products %>
```

```erb
<%= render @product %>
```

## Configuration

Disable it in `.herb.yml` when the implicit form is the house style:

```yaml
linter:
  rules:
    actionview-no-implicit-partial:
      enabled: false
```

## References

- [Action View - Rendering collections](https://guides.rubyonrails.org/layouts_and_rendering.html#rendering-collections)
