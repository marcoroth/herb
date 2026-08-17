# Linter Rule: Prefer `data-turbo-confirm` over the deprecated `data-confirm`

**Rule:** `ujs-prefer-turbo-confirm`

## Description

Disallow the `data-confirm` attribute and the Action View helper option that renders it, `data: { confirm: ... }`. Use `data-turbo-confirm` or `data: { turbo_confirm: ... }` instead.

## Rationale

Before Rails 7, Rails shipped `@rails/ujs` by default, which added JavaScript behavior to elements through helper options and `data-*` attributes. Rails 7 stopped including it, and Turbo covers the same behavior with its own attributes.

`data-confirm` made `@rails/ujs` prompt the user with the given question before proceeding, and cancel the action if the user declined. `data-turbo-confirm` is a drop-in replacement, so the migration is mechanical. The attribute is handled by Turbo, though, so the swap only takes effect once the app has migrated from `@rails/ujs` to Turbo.

Once `@rails/ujs` is gone the attribute is inert, and the failure is silent rather than loud: the link or button still works, but the confirmation prompt simply stops appearing. A destructive action that was guarded now fires on the first click.

## Examples

### ✅ Good

```erb
<a href="/posts/1" data-turbo-confirm="Are you sure?">Delete</a>
```

```erb
<%= link_to "Delete", post_path(@post), data: { turbo_confirm: "Are you sure?" } %>
```

```erb
<%= button_to "Delete", post_path(@post), data: { turbo_confirm: "Are you sure?" } %>
```

### 🚫 Bad

```erb
<a href="/posts/1" data-confirm="Are you sure?">Delete</a>
```

```erb
<%= link_to "Delete", post_path(@post), data: { confirm: "Are you sure?" } %>
```

```erb
<%= button_to "Delete", post_path(@post), data: { confirm: "Are you sure?" } %>
```

## Related Rules

* [`ujs-prefer-turbo-method`](./ujs-prefer-turbo-method.md)
* [`ujs-prefer-turbo-submits-with`](./ujs-prefer-turbo-submits-with.md)
* [`ujs-no-remote-attribute`](./ujs-no-remote-attribute.md)

## References

* [Rails `link_to` API](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
* [Rails Guides: Working with JavaScript in Rails](https://guides.rubyonrails.org/working_with_javascript_in_rails.html)
* [turbo-rails: Upgrading from Rails UJS / Turbolinks to Turbo](https://github.com/hotwired/turbo-rails/blob/main/UPGRADING.md#upgrading-from-rails-ujs--turbolinks-to-turbo)
* [Turbo Handbook: Drive](https://turbo.hotwired.dev/handbook/drive)
