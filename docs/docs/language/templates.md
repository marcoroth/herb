# Templates

ERB is Embedded Ruby, a string template language. It sees Ruby tags and text, and it does not know the text is HTML. Herb reads the same files as HTML+ERB, where the HTML and the Ruby are parsed together into one tree. The split is the one Elixir makes between EEx and HEEx (HTML+EEx).

Every template you already have is an HTML+ERB template. There is no new syntax to learn before Herb can read it, and nothing on this page requires changing a file.

## ERB and HTML+ERB

|                        | ERB                                   | HTML+ERB                                            |
|------------------------|---------------------------------------|-----------------------------------------------------|
| Reads the template as  | Text with Ruby tags                   | HTML elements, attributes and Ruby tags in one tree |
| Unclosed or mismatched tags | Reach the browser                | A compile error with the line and column            |
| `<%= %>` escaping      | One escape function everywhere        | Chosen by where the tag sits                        |
| Engine                 | `Erubi::Engine`                       | `Herb::Engine`                                      |

Because the structure is known before the template runs, tools can work on it too. The [linter](/projects/linter), [formatter](/projects/formatter) and [language server](/projects/language-server) all read the same tree the engine compiles.

## File extensions

| Extension     | Read as    |
|---------------|------------|
| `.html.erb`   | HTML+ERB   |
| `.html.herb`  | HTML+ERB   |
| `.herb`       | HTML+ERB   |
| `.turbo_stream.erb`, `.turbo_stream.herb` | HTML+ERB |

`.herb` names a template that is meant to be compiled by Herb. With the Rails 8.2 framework defaults, Rails compiles `.html.erb` templates through Herb on its own. In a Rails app with [ReActionView](https://reactionview.dev), `.herb` templates always go through it, and `.html.erb` templates do once `intercept_erb` is on.

Files that are not HTML, such as `.text.erb` mail bodies or `.yml.erb` fixtures, are plain ERB. Compile them with the [`html: false`](/parser-options) parser option so `<` is read as text.

## ERB tags

| Tag         | Does                                                        |
|-------------|-------------------------------------------------------------|
| `<% %>`     | Runs Ruby and outputs nothing                               |
| `<%= %>`    | Runs Ruby and outputs the result, escaped                   |
| `<%== %>`   | Runs Ruby and outputs the result without escaping           |
| `<%# %>`    | A comment, removed from the output                          |
| `<%- %>`    | Same as `<% %>`, accepted for compatibility                 |
| `-%>`       | Closes a tag and drops the newline after it                 |
| `<%% %>`    | Outputs the literal text `<% %>`                            |
| `<%%= %>`   | Outputs the literal text `<%= %>`                           |

[ERB Syntax](/language/erb) shows each of these in use, together with conditionals, loops and blocks. The escaped and raw split of `<%= %>` and `<%== %>` is the one Rails uses. Parser option [`erb_openers`](/parser-options#erb-openers) adds openers of your own, such as `<%graphql %>`.

## Whitespace

A `<% %>` or `<%# %>` tag that stands alone on its line is trimmed. The indentation before it and the newline after it do not reach the output.

::: code-group
```html+erb [app/views/posts/_status.html.erb]
<% case post.status %>
<% when :published %>
  <span class="badge">Published</span>
<% else %>
  <em>Draft</em>
<% end %>
```
:::

This is Erubi's default, so templates render the same under both. [Whitespace trimming](/projects/engine#whitespace-trimming) on the Engine page has the details.

## Elements must close in the same scope

An element opened inside an `if`, a block or a loop closes inside it too. Herb pairs tags within each branch of Ruby control flow, not across it.

::: code-group
```html+erb [app/views/posts/show.html.erb]
<% if current_user.admin? %>
  <div class="admin">
<% end %>
  </div>
```
:::

```
✘ [MissingClosingTagError] Opening tag `<div>` at (2:3) doesn't have a matching closing tag `</div>` in the same scope.
✘ [MissingOpeningTagError] Found closing tag `</div>` at (4:4) without a matching opening tag in the same scope.
```

Write the condition on the attribute, or put the whole element in each branch:

::: code-group
```html+erb [app/views/posts/show.html.erb]
<div class="<%= "admin" if current_user.admin? %>">
</div>
```
:::

## What Herb rejects

These compile under Erubi and fail under Herb, because each one sends broken HTML to the browser.

| Template                                   | Error                        |
|--------------------------------------------|------------------------------|
| `<h2><%= @post.title %></h3>`              | `MissingClosingTagError`, `MissingOpeningTagError` |
| `<p><%= link_to "Edit", edit_post_path(@post) </p>` | `UnclosedERBTagError` |
| `<input value="<%= @name %>"`              | `UnclosedOpenTagError`       |
| `<br></br>`                                | `VoidElementClosingTagError` |
| `<%= name <%= other %>`                    | `NestedERBTagError`          |

With `Herb::Engine`, each of these is a `Herb::Engine::ParseError` at compile time. The message points at the line and says what to change:

```
✘ [MissingClosingTagError] Opening tag `<h2>` at (2:3) doesn't have a matching closing tag `</h2>` in the same scope.

    app/views/posts/_card.html.erb:2:3:
      2 │   <h2><%= @post.title %></h3>
        ╵   ~~~~

  Add the closing tag, or make it self-closing.
```

In development, ReActionView shows the same message in an overlay on the page instead of raising.

## Optional closing tags

HTML lets some elements leave out their closing tag, such as `<p>` and `<li>`. Herb reads these the way a browser does, and reports `OmittedClosingTagError` so the tag gets written out. Set the [`strict`](/parser-options) parser option to `false` to accept them.

## Escaping follows the context

`<%= %>` is escaped for where it sits. Erubi escapes every tag the same way, because it does not know where the tag is.

| Where the tag sits           | Escaped with            |
|------------------------------|-------------------------|
| Text content                 | `Herb::Engine.h`        |
| An attribute value           | `Herb::Engine.attr`     |
| Inside `<script>`            | `Herb::Engine.js`       |
| Inside `<style>`             | `Herb::Engine.css`      |

`<%= %>` in an attribute name or in the middle of an open tag is refused by the [`SecurityValidator`](/projects/engine#validators), since no escaping makes it safe.

## Related

- [Parser options](/parser-options) for `strict`, `html` and `erb_openers`
- [ERB Syntax](/language/erb) for output, comments, conditionals, loops and blocks
- [Strict locals](/language/strict-locals) for declaring what a partial takes
- [Erubi compatibility](/projects/engine#erubi-compatibility) for every known difference from Erubi
