# Linter Rule: Prefer `image_tag` helper over `<img>` with ERB expressions

**Rule:** `erb-prefer-image-tag-helper`

## Description

Prefer using Rails' `image_tag` helper over manual `<img>` tags with dynamic ERB expressions like `image_path` or `asset_path`.

## Rationale

- The `image_tag` helper properly escapes the `src` value
- Reduces template complexity
- Simplifies adding attributes
- Ensures consistent rendering
- Prevents interpolation issues

## Examples

### ✅ Good

```erb
<!-- Simple image_tag usage -->
<%= image_tag "logo.png", alt: "Logo" %>
<%= image_tag "banner.jpg", alt: "Banner", class: "hero-image" %>
<%= image_tag "icon.svg", alt: "Icon", size: "24x24" %>

<!-- Dynamic expressions -->
<%= image_tag user.avatar.url, alt: "User avatar" %>

<!-- Mixed content using string interpolation -->
<%= image_tag "#{root_url}/banner.jpg", alt: "Banner" %>
<%= image_tag "#{base_url}#{image_path('icon.png')}", alt: "Icon" %>

<!-- Static image paths are fine -->
<img src="/static/logo.png" alt="Logo">
```

### 🚫 Bad

```erb
<!-- Single ERB expressions -->
<img src="<%= image_path("logo.png") %>" alt="Logo">

<img src="<%= asset_path("banner.jpg") %>" alt="Banner">

<img src="<%= user.avatar.url %>" alt="User avatar">

<img src="<%= product.image %>" alt="Product image">


<!-- Mixed ERB and text content -->
<img src="<%= Rails.application.routes.url_helpers.root_url %>/icon.png" alt="Logo">

<img src="<%= root_url %>/banner.jpg" alt="Banner">

<img src="<%= admin_path %>/icon.png" alt="Admin icon">


<!-- Multiple ERB expressions -->
<img src="<%= base_url %><%= image_path("logo.png") %>" alt="Logo">

<img src="<%= root_path %><%= "icon.png" %>" alt="Icon">
```

## References

* [Rails `image_tag` helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/AssetTagHelper.html#method-i-image_tag)
* [Rails `image_path` helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/AssetUrlHelper.html#method-i-image_path)
* [Rails `asset_path` helper documentation](https://api.rubyonrails.org/classes/ActionView/Helpers/AssetUrlHelper.html#method-i-asset_path)
