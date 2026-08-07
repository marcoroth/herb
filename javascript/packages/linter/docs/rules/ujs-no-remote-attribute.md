# Linter Rule: Disallow the deprecated `data-remote` attribute

**Rule:** `ujs-no-remote-attribute`

## Description

Disallow the `data-remote` attribute and the Action View helper options that render it, namely `remote:` and `data: { remote: ... }`. Unlike the other deprecated `@rails/ujs` attributes, this one has no Turbo attribute to swap in. Turbo handles links and form submissions by default, so the attribute is removed rather than replaced.

## Rationale

Before Rails 7, Rails shipped `@rails/ujs` by default, which added JavaScript behavior to elements through helper options and `data-*` attributes. Rails 7 stopped including it, and Turbo covers the same behavior with its own attributes.

`data-remote` made `@rails/ujs` issue the request over Ajax instead of navigating, and hand the response to the browser as executable JavaScript. Turbo Drive intercepts links and form submissions on the whole page already, so there is nothing to opt into and no `data-turbo-remote` to write.

Once `@rails/ujs` is gone the attribute is inert, and what is left is markup that claims a behavior the page no longer has. Because the attribute reads as deliberate, it hides the fact that these requests are now plain navigations.

## Examples

### ✅ Good

```erb
<a href="/posts">Load posts</a>
```

```erb
<%= link_to "Load posts", posts_path %>
```

### 🚫 Bad

```erb
<a href="/posts" data-remote="true">Load posts</a>
```

```erb
<%= link_to "Load posts", posts_path, remote: true %>
```

```erb
<%= link_to "Load posts", posts_path, data: { remote: true } %>
```

## Migration

For most links and forms the attribute is simply deleted, because Turbo Drive already does what `data-remote` asked for.

This is the one deprecated `@rails/ujs` attribute whose removal is not always a drop-in change, so it is worth checking what the endpoint returns before deleting it. A `data-remote` request whose response rendered JavaScript needs that response to become a Turbo Stream, or the element needs to live inside a Turbo Frame. Removing the attribute without making that change turns what was a background request into a full page navigation.

## Related Rules

* [`ujs-prefer-turbo-method`](./ujs-prefer-turbo-method.md)
* [`ujs-prefer-turbo-confirm`](./ujs-prefer-turbo-confirm.md)
* [`ujs-prefer-turbo-submits-with`](./ujs-prefer-turbo-submits-with.md)

## References

* [Rails Guides: Working with JavaScript in Rails](https://guides.rubyonrails.org/working_with_javascript_in_rails.html)
* [Turbo Handbook: Drive](https://turbo.hotwired.dev/handbook/drive)
* [Turbo Handbook: Streams](https://turbo.hotwired.dev/handbook/streams)
