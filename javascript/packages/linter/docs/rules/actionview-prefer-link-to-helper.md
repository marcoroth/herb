# Linter Rule: Prefer `link_to` over a manual `<a>` tag with an ERB `href`

**Rule:** `actionview-prefer-link-to-helper`

## Description

Reports an `<a>` tag whose `href` is a single ERB output tag, and reports the `link_to` call that replaces it, with the link's other attributes carried across as options.

When the link's content is one piece of text, or one output tag holding an expression that can move into an argument list, the replacement uses the text argument:

```erb
<a href="<%= user_path(@user) %>" class="btn" data-turbo-method="delete">Profile</a>
```

Anything else reports the block form, which leaves the content exactly where it is:

```erb
<a href="<%= post_path(@post) %>">
  <span class="icon"></span>
  Read more
</a>
```

## Rationale

`link_to` is the Action View API for links. It runs the URL through `url_for`, so the same call accepts a route helper, a plain String, a model, an array, or an options Hash, and it builds the rest of the tag from a Ruby Hash, so classes, `data:` options and conditional attributes are expressed as Ruby rather than as interpolation inside markup.

The rule does not care whether the expression is a route helper. `url_for` returns a String unchanged, so `link_to "Docs", @external_url` renders exactly what `<a href="<%= @external_url %>">Docs</a>` renders, and the same holds for a helper of your own, a local variable, or an interpolated String. What the rule keys on is that the `href` is computed at all, which is the point where `link_to` starts paying for itself.

A link whose `href` is a literal, a fragment, or an external URL is left alone.

### What is left alone

- An `href` that holds more than the expression, since `"<%= root_path %>#section"` needs the fragment folded into the argument before `link_to` can express it.
- An expression carrying its own control flow, such as `<%= @event.url if @event.published? %>`, since a modifier `if` binds to the whole `link_to` call once it is moved into an argument list.

## Autofix

This rule is autocorrectable. The fix replaces the whole element, so it only runs when every attribute converts exactly. Roughly one offense in eight is reported without a fix, because one of these applies:

- A value that cannot go into a double quoted Ruby string as written, because it contains `"`, `\`, `#`, or an `&` that may start an entity reference.
- An attribute with no value, such as `download`. `download: true` renders `download="true"`, which names the downloaded file rather than leaving it to the browser.
- An attribute name that is not a Ruby key, such as Alpine's `@click`, or a name built from ERB.
- An attribute repeated on the same tag, which resolves to the first one in HTML and to the last one in a Ruby Hash.
- An ERB tag sitting between the attributes rather than inside one.

In those cases the message still reports the `link_to` call for the URL and the content, and says that the remaining attributes have to move by hand.

Where a call was written without parentheses, both the message and the fix put them back, since `link_to image_tag "logo.svg", alt: "Home", root_path` is a syntax error and `link_to url_for action: :index do` would hand the block to `url_for`.

## Examples

### ✅ Good

```erb
<%= link_to "Dashboard", dashboard_path %>
```

```erb
<%= link_to user_path(@user), class: "btn" do %>
  Profile
<% end %>
```

```erb
<a href="https://example.com">Example</a>
```

```erb
<a href="#main">Skip to content</a>
```

### 🚫 Bad

```erb
<a href="<%= dashboard_path %>">Dashboard</a>
```

```erb
<a href="<%= user_path(@user) %>" class="btn">Profile</a>
```

```erb
<a href="<%= @external_url %>">Docs</a>
```

```erb
<a href="<%= url_for(@post) %>"><%= @post.title %></a>
```

## Configuration

This rule only applies to Action View projects, so it needs `framework` to be set:

```yaml
framework: actionview
```

## References

- [`ActionView::Helpers::UrlHelper#link_to`](https://api.rubyonrails.org/classes/ActionView/Helpers/UrlHelper.html#method-i-link_to)
