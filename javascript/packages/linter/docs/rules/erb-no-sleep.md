# Linter Rule: Disallow `sleep` in ERB templates

**Rule:** `erb-no-sleep`

## Description

This rule disallows calling `sleep` and `Kernel.sleep` in ERB templates.

## Rationale

`sleep` blocks the thread that is rendering the response. Nothing is sent to the browser until the template finishes, so every second spent sleeping is a second added to the response time of every request that hits the template, and the worker handling it cannot serve anyone else in the meantime.

A `sleep` in a template is almost always left over from local work, such as demonstrating a loading state, reproducing a race condition, or waiting for something that has not finished yet. None of those need to happen in the template: artificial latency belongs in development-only middleware where it can be enabled and removed in one place, and work that takes time belongs in a background job.

`sleep` called on another receiver, such as `client.sleep`, is not reported, since that is an unrelated method that happens to share the name.

## Examples

### ✅ Good

```erb
<%= render "products/list", products: @products %>
```

### 🚫 Bad

```erb
<% sleep 2 %>
```

```erb
<% Kernel.sleep(0.5) %>
```

```erb
<% @products.each do |product| %>
  <% sleep 0.1 %>
  <%= product.name %>
<% end %>
```

## References

- [`Kernel#sleep`](https://ruby-doc.org/core/Kernel.html#method-i-sleep)
