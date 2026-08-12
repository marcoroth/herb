# Linter Rule: Prefer `data-turbo-method` over the deprecated `data-method`

**Rule:** `ujs-prefer-turbo-method`

## Description

Disallow the `data-method` attribute and the Action View link helper options that render it, namely `method:` and `data: { method: ... }`. Use `data-turbo-method` or `data: { turbo_method: ... }` instead.

## Rationale

Before Rails 7, Rails shipped `@rails/ujs` by default, which added JavaScript behavior to elements through helper options and `data-*` attributes. Rails 7 stopped including it, and Turbo covers the same behavior with its own attributes.

`data-method` made `@rails/ujs` build a hidden form and submit it with the given verb, so that a plain link could issue a `DELETE`, `PATCH`, `POST` or `PUT` request. `data-turbo-method` is a drop-in replacement, so the migration is mechanical. The attribute is handled by Turbo, though, so the swap only takes effect once the app has migrated from `@rails/ujs` to Turbo.

Once `@rails/ujs` is gone the attribute is inert, and the failure is silent rather than loud: the link still works, but it issues a `GET` to the same URL. A "Delete" link quietly turns into a link that shows the record instead of destroying it.

Note that `method:` on `button_to` and the `form_*` helpers is unaffected. Those render a real form and set the verb through a hidden `_method` field, which never involved `@rails/ujs`.

## Examples

### ✅ Good

```erb
<a href="/posts/1" data-turbo-method="delete">Delete</a>
```

```erb
<%= link_to "Delete", post_path(@post), data: { turbo_method: :delete } %>
```

```erb
<%= button_to "Delete", post_path(@post), method: :delete %>
```

### 🚫 Bad

```erb
<a href="/posts/1" data-method="delete">Delete</a>
```

```erb
<%= link_to "Delete", post_path(@post), method: :delete %>
```

```erb
<%= link_to "Delete", post_path(@post), data: { method: :delete } %>
```

## Related Rules

* [`ujs-prefer-turbo-confirm`](./ujs-prefer-turbo-confirm.md)
* [`ujs-prefer-turbo-submits-with`](./ujs-prefer-turbo-submits-with.md)
* [`ujs-no-remote-attribute`](./ujs-no-remote-attribute.md)

## References

* [Rails `link_to` API](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
* [Rails Guides: Working with JavaScript in Rails](https://guides.rubyonrails.org/working_with_javascript_in_rails.html)
* [turbo-rails: Upgrading from Rails UJS / Turbolinks to Turbo](https://github.com/hotwired/turbo-rails/blob/main/UPGRADING.md#upgrading-from-rails-ujs--turbolinks-to-turbo)
* [Turbo Handbook: Drive](https://turbo.hotwired.dev/handbook/drive)
