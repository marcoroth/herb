# Linter Rule: Disallow unnecessary `tag.attributes` usage

**Rule:** `actionview-no-unnecessary-tag-attributes`

## Description

Disallow using `tag.attributes` inside a plain HTML tag when the same result can be achieved with a tag helper like `tag.input`, `tag.div`, etc., or by adding the attributes directly to the HTML tag.

## Rationale

Rails provides tag helpers (`tag.input`, `tag.div`, `tag.span`, etc.) that generate complete HTML elements with properly escaped attributes. Using `tag.attributes` inside a manually written HTML tag to achieve the same result is redundant and harder to read.

The `tag.attributes` helper is useful when combined with other HTML attributes or in contexts where a full tag helper cannot be used, but wrapping all attributes of a plain HTML element in `tag.attributes` is unnecessary and less idiomatic.

Using a tag helper or plain HTML attributes instead is:
- More concise and idiomatic Rails.
- Easier to read and maintain.
- Less error-prone since the helper handles escaping and self-closing behavior.

## Examples

### ✅ Good

```erb
<input type="text" aria-label="Search">
```

```erb
<%= tag.input type: :text, aria: { label: "Search" } %>
```

```erb
<div id="container" class="wrapper">
  Content
</div>
```

```erb
<%= tag.div id: "container", class: "wrapper" do %>
  Content
<% end %>
```

```erb
<img src="<%= image_path("logo.png") %>" alt="Logo">
```

```erb
<%= tag.img src: image_path("logo.png"), alt: "Logo" %>
```

Using `tag.attributes` alongside regular HTML attributes is allowed:

```erb
<button class="primary" <%= tag.attributes(id: @call_to_action_id, aria: { expanded: @expanded }) %>>
  Get Started!
</button>
```

### 🚫 Bad

```erb
<input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>
```

```erb
<div <%= tag.attributes(id: @container_id, class: @wrapper_class) %>>
  Content
</div>
```

```erb
<img <%= tag.attributes(src: image_path("logo.png"), alt: "Logo") %>>
```

## References

* [Rails `tag` API](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)
* [Rails `tag.attributes` API](https://api.rubyonrails.org/classes/ActionView/Helpers/TagHelper.html#method-i-tag)
