# Linter Rule: Prefer `data-turbo-submits-with` over the deprecated `data-disable-with`

**Rule:** `ujs-prefer-turbo-submits-with`

## Description

Disallow the `data-disable-with` attribute and the Action View helper option that renders it, `data: { disable_with: ... }`. Use `data-turbo-submits-with` or `data: { turbo_submits_with: ... }` instead.

## Rationale

Before Rails 7, Rails shipped `@rails/ujs` by default, which added JavaScript behavior to elements through helper options and `data-*` attributes. Rails 7 stopped including it, and Turbo covers the same behavior with its own attributes.

`data-disable-with` made `@rails/ujs` disable the submit button and swap its label for the given text while the request was in flight, which is what stopped users from double submitting a form. `data-turbo-submits-with` is a drop-in replacement, so the migration is mechanical. The attribute is handled by Turbo, though, so the swap only takes effect once the app has migrated from `@rails/ujs` to Turbo.

Once `@rails/ujs` is gone the attribute is inert, and the failure is silent rather than loud: the form still submits, but the button stays live and keeps its original label. Double submissions become possible again on exactly the forms that were annotated to prevent them.

## Examples

### ✅ Good

```erb
<button data-turbo-submits-with="Saving...">Save</button>
```

```erb
<%= f.submit "Save", data: { turbo_submits_with: "Saving..." } %>
```

```erb
<%= submit_tag "Save", data: { turbo_submits_with: "Saving..." } %>
```

### 🚫 Bad

```erb
<button data-disable-with="Saving...">Save</button>
```

```erb
<%= f.submit "Save", data: { disable_with: "Saving..." } %>
```

```erb
<%= submit_tag "Save", data: { disable_with: "Saving..." } %>
```

## Related Rules

* [`ujs-prefer-turbo-method`](./ujs-prefer-turbo-method.md)
* [`ujs-prefer-turbo-confirm`](./ujs-prefer-turbo-confirm.md)
* [`ujs-no-remote-attribute`](./ujs-no-remote-attribute.md)

## References

* [Rails `submit_tag` API](https://api.rubyonrails.org/classes/ActionView/Helpers/FormTagHelper.html#method-i-submit_tag)
* [Rails Guides: Working with JavaScript in Rails](https://guides.rubyonrails.org/working_with_javascript_in_rails.html)
* [turbo-rails: Upgrading from Rails UJS / Turbolinks to Turbo](https://github.com/hotwired/turbo-rails/blob/main/UPGRADING.md#upgrading-from-rails-ujs--turbolinks-to-turbo)
* [Turbo Handbook: Drive](https://turbo.hotwired.dev/handbook/drive)
