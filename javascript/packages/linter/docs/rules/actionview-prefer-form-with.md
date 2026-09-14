# Linter Rule: Prefer the `form_with` helper over `form_for`

**Rule:** `actionview-prefer-form-with`

## Description

Report calls to the `form_for` helper and point at `form_with`, which is the form builder Rails documents today.

`fields_for` is not part of this rule. It is the current API for nested attributes and is used together with `form_with`, so it is never reported.

## Rationale

The Rails guides removed the `form_for` documentation and left a single closing section stating that `form_tag` and `form_for` are now discouraged in favor of `form_with`. The API docs still list `form_for` without a deprecation notice, there is no runtime deprecation warning, and no RuboCop cop covers it, so nothing in the toolchain tells you that a template is still on the Rails 5.0-era form API.

`form_with` covers everything `form_for` does. A record moves into `model:`, an `as:` option becomes `scope:`, and the `html:` hash flattens into top-level options.

```erb
<%= form_for @user, as: :customer, html: { class: "login" } do |form| %>
  <%= form.text_field :name %>
<% end %>
```

becomes

```erb
<%= form_with model: @user, scope: :customer, class: "login" do |form| %>
  <%= form.text_field :name %>
<% end %>
```

The rule keys on a receiverless `form_for` call, so a helper of the same name called on an explicit receiver is left alone.

## Examples

### ✅ Good

```erb
<%= form_with model: @user do |form| %>
  <%= form.text_field :name %>
<% end %>
```

```erb
<%= form_with model: [:admin, @user], scope: :customer do |form| %>
  <%= form.text_field :name %>
<% end %>
```

```erb
<%= form_with model: @user do |form| %>
  <%= form.fields_for :address do |address_form| %>
    <%= address_form.text_field :street %>
  <% end %>
<% end %>
```

### 🚫 Bad

```erb
<%= form_for @user do |form| %>
  <%= form.text_field :name %>
<% end %>
```

```erb
<%= form_for [:admin, @user], as: :customer do |form| %>
  <%= form.text_field :name %>
<% end %>
```

```erb
<%= form_for @user, url: session_path, html: { class: "login" } do |form| %>
  <%= form.email_field :email %>
<% end %>
```

## References

- [Rails Guides: Form Helpers, "Using `form_tag` and `form_for`"](https://guides.rubyonrails.org/form_helpers.html#using-form-tag-and-form-for)
- [`ActionView::Helpers::FormHelper#form_for`](https://api.rubyonrails.org/classes/ActionView/Helpers/FormHelper.html#method-i-form_for)
- [`ActionView::Helpers::FormHelper#form_with`](https://api.rubyonrails.org/classes/ActionView/Helpers/FormHelper.html#method-i-form_with)
