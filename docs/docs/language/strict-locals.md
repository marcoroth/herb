# Strict locals

Strict locals are a Rails feature. A magic comment at the top of a partial declares which locals it takes, and Rails raises when a caller passes one it does not declare or leaves out one it requires. Herb reads the same comment, so the linter can check every `render` call against it before the page runs.

::: code-group
```erb [app/views/posts/_card.html.erb]
<%# locals: (post:, compact: false) %>

<article class="<%= "compact" if compact %>">
  <h2><%= post.title %></h2>
</article>
```
:::

## `locals:`

Declares the locals a template takes.

```erb notwoslash
<%# locals: (name:, name: default, **rest) %>
```

The signature is a Ruby keyword parameter list. A keyword without a default is required, and a keyword with one is optional. A `**` splat accepts any other local, and `()` declares that the template takes none.

Put the declaration on the first line of the partial, followed by a blank line. Rails reads only the first declaration in a template.

## What Herb rejects

Rails passes locals by name, so only keyword parameters mean anything in the signature. Herb reports anything else as a parse error with the [`strict_locals`](/parser-options) parser option on.

| Template                               | Error                                    |
|----------------------------------------|------------------------------------------|
| `<%# locals: (title) %>`               | `StrictLocalsPositionalArgumentError`    |
| `<%# locals: (*items) %>`              | `StrictLocalsSplatArgumentError`         |
| `<%# locals: (&block) %>`              | `StrictLocalsBlockArgumentError`         |
| `<%# locals: title: %>`                | `StrictLocalsMissingParenthesisError`    |
| A second `<%# locals: (...) %>`        | `StrictLocalsDuplicateDeclarationError`  |

```
Strict locals only support keyword arguments. Positional argument `title` is not allowed. Use keyword argument format: `title:`.
```

## Checking callers

The linter resolves each `render` call to its partial and compares the locals it passes with the declaration. It reports a required local that is not passed and a local the partial does not declare. It also reports a literal whose type contradicts the default, such as `compact: "yes"` for `compact: false`.

::: code-group
```erb [app/views/posts/index.html.erb]
<% @posts.each do |post| %>
  <%= render "posts/card", post: post, compact: true %>
<% end %>
```
:::

## Strict locals and state

A [state](/language/state) may take its starting value from a strict local, as in `<%# herb:state (open: open_initially) %>`. A name cannot be both a strict local and a state, since a local comes from the caller and a state is owned by the client. To share a state with the caller instead of copying its value, [bind it](/language/state#binding-a-partial-s-state) with `state:` on the `render` call.

## Related rules

- [`erb-strict-locals-comment-syntax`](/linter/rules/erb-strict-locals-comment-syntax)
- [`actionview-strict-locals-first-line`](/linter/rules/actionview-strict-locals-first-line)
- [`actionview-strict-locals-partial-only`](/linter/rules/actionview-strict-locals-partial-only)
- [`actionview-no-unused-strict-locals`](/linter/rules/actionview-no-unused-strict-locals)
- [`actionview-no-redundant-local-assigns`](/linter/rules/actionview-no-redundant-local-assigns)
- [`actionview-no-strict-locals-error`](/linter/rules/actionview-no-strict-locals-error)
- [`actionview-no-mistyped-locals`](/linter/rules/actionview-no-mistyped-locals)
- [`erb-strict-locals-required`](/linter/rules/erb-strict-locals-required)
