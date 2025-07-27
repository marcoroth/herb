# Linter Rule: Prefer `image_tag` helper over manual `<img>` tags

**Rule:** `erb-prefer-image-tag-helper`

## Description

Prefer using Rails' `image_tag` helper over manual `<img>` tags with `image_path` or `asset_path`.

## Rationale

- The `image_tag` helper properly escapes the `src` value
- Reduces template complexity
- Simplifies adding attributes
- Ensures consistent rendering
- Prevents interpolation issues

## Examples

### ✅ Good

```erb
<%= image_tag "logo.png", alt: "Logo" %>
<%= image_tag "banner.jpg", alt: "Banner", class: "hero-image" %>
<%= image_tag "icon.svg", alt: "Icon", size: "24x24" %>

<!-- Static image paths are fine -->
<img src="/static/logo.png" alt="Logo">

<!-- Dynamic URLs without helpers are fine -->
<img src="<%= user.avatar.url %>" alt="User avatar">
```

### 🚫 Bad

```erb
<img src="<%= image_path("logo.png") %>" alt="Logo">
<img src="<%= asset_path("banner.jpg") %>" alt="Banner">
<img src="<%=  image_path( "icon.svg" )  %>" alt="Icon">
<img src="<%= Rails.application.routes.url_helpers.root_url %>/icon.png" alt="Logo">
<img src="<%= root_url %>/banner.jpg" alt="Banner">
```

## References

* [Rails image_tag helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/AssetTagHelper.html#method-i-image_tag)
* [Rails image_path helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/AssetUrlHelper.html#method-i-image_path)
* [Rails asset_path helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/AssetUrlHelper.html#method-i-asset_path)
