# Linter Rule: Disallow locals that shadow a `render` option name

**Rule:** `actionview-no-render-option-shadowing`

## Description

Detects locals passed to the shorthand `render "partial", ...` form whose name matches a `render` option, such as `collection:`, `object:` or `layout:`.

## Rationale

`render` accepts a partial two ways, and the same keyword means different things in each. In the shorthand form the first argument names the partial and everything after it becomes the locals hash:

```ruby
render "card", collection: @products
# => render_partial(partial: "card", locals: { collection: @products })
```

In the keyword form it is a render option, and the partial is rendered once per item:

```ruby
render partial: "card", collection: @products
```

Both are valid and neither raises. A reader cannot tell from the call alone which was meant, and switching a call between the two forms during a refactor silently changes what it does.

Passing the value inside an explicit `locals:` hash removes the ambiguity. It produces exactly the same locals as the shorthand form, so the change is safe to make mechanically:

```ruby
render partial: "card", locals: { collection: @products }
```

This is a naming collision rather than a mistake. A partial is free to take a local called `object` or `collection`, and plenty do, which is why the rule reports at `info` and points at the explicit form instead of asking you to rename anything.

Locals already written inside a `locals:` hash are never reported.

## Examples

### ✅ Good

```erb
<%= render partial: "card", locals: { collection: @products } %>
```

```erb
<%= render partial: "card", collection: @products, as: :item %>
```

```erb
<%= render "card", title: "Featured", product: @product %>
```

### 🚫 Bad

```erb
<%= render "card", collection: @products %>
```

```erb
<%= render "shared/error_messages", object: @user %>
```

```erb
<%= render "card", layout: "wide" %>
```

## References

- [Action View - Rendering partials](https://guides.rubyonrails.org/layouts_and_rendering.html#using-partials)
- [Rails API - `ActionView::Helpers::RenderingHelper#render`](https://api.rubyonrails.org/classes/ActionView/Helpers/RenderingHelper.html#method-i-render)
