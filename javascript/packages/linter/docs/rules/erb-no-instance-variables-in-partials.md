# Linter Rule: Disallow instance variables in partials

**Rule:** `erb-no-instance-variables-in-partials`

## Description

Prevent usage of instance variables inside ERB partials. Using instance variables inside partials can cause issues as their dependency is defined outside of the partial itself. This makes partials more fragile and less reusable. Local variables should be passed directly to partial renders.

A partial is any template whose filename begins with an underscore (e.g. `_card.html.erb`).

Instance variables in partials create implicit dependencies on the controller or parent view, making partials harder to reuse, test, and reason about. Passing data as local variables makes the partial's interface explicit and self-documenting.

## Examples

### ✅ Good

```erb [app/views/posts/index.html.erb]
<%= render partial: "posts/card", locals: { post: @post } %>
```

```erb [app/views/posts/_card.html.erb]
<div>
  <%= post.title %>
</div>
```

### 🚫 Bad

```erb [app/views/posts/index.html.erb]
<%= render partial: "posts/card" %>
```

```erb [app/views/posts/_card.html.erb]
<div>
  <%= @post.title %>
</div>
```

## References

- [Rails Guide: Using Partials](https://guides.rubyonrails.org/layouts_and_rendering.html#using-partials)
- [Rails Guide: Passing Local Variables](https://guides.rubyonrails.org/layouts_and_rendering.html#passing-local-variables)
- [Inspiration: ERB Lint `PartialInstanceVariable` rule](https://github.com/Shopify/erb_lint?tab=readme-ov-file#partialinstancevariable)
