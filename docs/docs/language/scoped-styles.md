# Scoped styles <Badge type="tip" text="^0.11.0" /> <Badge type="warning" text="experimental" />

A `<style scoped>` block styles the markup written in the same file, and nothing else on the page. A partial can name its classes `.title` and `.card` without colliding with any other template.

::: code-group
```erb [app/views/posts/_card.html.erb]
<style scoped>
  .card { padding: 1rem; }
  .card a { color: red; }
</style>

<div class="card">
  <%= link_to "Read more", post_path(post) %>
</div>
```
:::

Compiles to:

```html
<style data-herb-style-scoped="data-herb-scope-bf0ebc68">.card[data-herb-scope-bf0ebc68] {
  padding: 1rem;
}

.card a[data-herb-scope-bf0ebc68] {
  color: red;
}
</style>

<div class="card" data-herb-scope-bf0ebc68>
  <a href="/posts/1" data-herb-scope-bf0ebc68>Read more</a>
</div>
```

## `<style scoped>`

The scope is the file. Every element the file writes carries a `data-herb-scope-` attribute derived from its path, and every selector in the block requires it. An element written by a helper that Herb compiles to HTML, such as `link_to`, carries the scope too.

Markup from a rendered partial, a `yield`, or `raw` and `html_safe` output does not carry it, so a partial styles itself with its own block. Write one block per file, at the top level of the file, since the block applies to the whole file wherever it sits. The CSS has to be static, and a block built with ERB is left unscoped and reported.

## Turning it on

Scoped styles compile when the engine runs `Herb::Engine::ScopedStyle::Visitor`. The CSS is rewritten by the [`lightningcss`](https://github.com/marcoroth/lightningcss-ruby) gem, which Herb does not depend on.

::: code-group
```ruby [Gemfile]
gem "lightningcss"
```
:::

In a Rails app, add the visitor to ReActionView's engine stack:

::: code-group
```ruby [config/initializers/reactionview.rb]
require "herb/engine/scoped_style/visitor"

ReActionView.configure do |config|
  config.engine.visitors.use(Herb::Engine::ScopedStyle::Visitor.new)
end
```
:::

Without `lightningcss`, the block is left as written and a diagnostic says so. Scoping the markup while leaving the CSS global would be worse than doing neither.

The [`ScopedStyle::Visitor` page](/projects/engine/visitors/scoped-style) covers the `deliver` option, which writes the CSS once per page instead of once per render, and how to supply another CSS transform.

## Related rules

- [`herb-scoped-style-no-unused-selector`](/linter/rules/herb-scoped-style-no-unused-selector)
- [`herb-scoped-style-require-top-level`](/linter/rules/herb-scoped-style-require-top-level)
- [`herb-scoped-style-single-declaration`](/linter/rules/herb-scoped-style-single-declaration)
