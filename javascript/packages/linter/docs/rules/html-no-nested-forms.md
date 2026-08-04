# Linter Rule: Disallow nested forms

**Rule:** `html-no-nested-forms`

## Description

Disallow placing one `<form>` element inside another `<form>` element. HTML does not support nested forms. Doing so results in invalid markup and unpredictable behavior.

```erb
<%= form_with model: @mission do |form| %>
  <%= form.submit "Update" %>
  <%= button_to "Delete", mission_path(@mission), method: :delete %>
<% end %>
```

```
`button_to` renders its own `<form>` element and cannot be nested inside another `<form>`. Move it outside of the enclosing `<form>`.
```

## Rationale

Nesting forms is invalid according to the HTML specification. Browsers will automatically close any open `<form>` tag when encountering a new `<form>` start tag, often leading to:

- broken form submissions,
- incomplete or missing form fields,
- confusing DOM structure,
- inconsistent behavior across browsers.

Even if some browsers attempt to handle this situation, the resulting form behavior is unreliable and prone to subtle bugs.

The rule also covers Rails helpers that the Action View helper registry identifies as rendering a `<form>` element: `form_with`, `form_for`, `form_tag`, and `button_to`. The helper case is particularly easy to miss because the nested `<form>` never appears in the template. A common example is `button_to` inside a `form_with` block: `button_to` generates its own `<form>`, browsers drop it during parsing, and clicking the button silently submits the outer form instead.

This rule ensures that each form is properly isolated.

## Examples

### ✅ Good

```erb
<form>
  <input type="text" name="name">
</form>

<form>
  <input type="text" name="email">
</form>
```

```erb
<%= form_with model: @user do |form| %>
  <%= form.text_field :name %>
  <%= form.submit %>
<% end %>

<%= button_to "Delete", user_path(@user), method: :delete %>
```

```erb
<form id="account-form">
  <input type="hidden" name="token" value="abc">
</form>

<button type="submit" form="account-form">Save</button>
```

### 🚫 Bad

```erb
<form>
  <input type="text" name="name">

  <form>
    <input type="text" name="nested">
  </form>
</form>
```

```erb
<%= form_with model: @user do |user_form| %>
  <%= form_with model: @address do |address_form| %>
    <%= address_form.text_field :street %>
  <% end %>
<% end %>
```

```erb
<%= form_with model: @mission do |form| %>
  <%= form.submit "Update" %>
  <%= button_to "Delete", mission_path(@mission), method: :delete %>
<% end %>
```

## References

* [HTML Living Standard - Forms](https://html.spec.whatwg.org/multipage/forms.html#the-form-element)
* [Rails `form_with` documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/FormHelper.html#method-i-form_with)
* [Rails `button_to` documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-button_to)
