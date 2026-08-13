# Linter Rule: Prefer partial paths qualified from the view root

**Rule:** `actionview-prefer-qualified-partial-path`

## Description

Detects `render` calls that name a partial without a directory, such as `render "card"`, where the file resolved depends on which template the call appears in.

## Rationale

An unqualified name is resolved relative to the directory of the template doing the rendering, so the same call renders different files depending on where it lives:

```erb
<%# app/views/posts/index.html.erb %>
<%= render "card" %>
```

That reads `app/views/posts/_card.html.erb`, or `app/views/application/_card.html.erb` if the first does not exist. Neither is visible from the call.

Writing the path from the view root removes the dependency on context:

```erb
<%= render "posts/card" %>
```

Three things get easier. Searching for every caller of a partial finds them, because they all spell it the same way. Moving a template to another directory no longer silently changes which partial it renders. And renaming the partial becomes a matter of updating the callers that a search actually turns up.

Herb's partial index gains from it too. A qualified name resolves to the same entry from any template, so the language server can jump from the call to the partial and back to every caller, rename a strict local across all of those call sites at once, complete the locals a partial declares as you type them, and report a call that passes a local the partial does not declare or omits one it requires. An unqualified name has to be resolved from wherever the call happens to sit, and two calls that look like they render the same partial may not.

Short names are idiomatic Rails and extremely common, so this reports at `info`: it is guidance for codebases that want their template dependencies explicit and greppable, not a defect report.

When the project's partials are known, the message names the path to write. Otherwise it asks for the full path without guessing at one.

Only output tags are reported. A `render` in a silent `<% %>` tag discards its output and is covered by [`actionview-no-silent-render`](./actionview-no-silent-render.md).

## Autofix

`--fix-unsafely` rewrites the name to the path from the view root, but only when the partial resolves to a file sitting in the same directory as the template that renders it:

```erb
<%# app/views/posts/index.html.erb, next to app/views/posts/_card.html.erb %>
<%= render "card" %>
```

becomes

```erb
<%= render "posts/card" %>
```

Everywhere else the rewrite is not offered, and the offense reports the path to write without correcting it. A name resolved out of `app/views/application` is left alone, because a template that inherits from another controller may resolve it somewhere closer at runtime.

The fix stays unsafe even for a co-located partial. Rails resolves an unqualified name against the prefixes of the controller doing the rendering, not against the directory the calling template happens to live in. Those agree for a template under the controller's own view directory, which is the convention this rule assumes, but a template rendered by a different controller resolves the name somewhere else, and writing the path from the view root pins it to the file next door.

The rewrite is also skipped when the same quoted string appears more than once in the ERB tag, since the one to rewrite cannot be told apart from the rest.

## Examples

### ✅ Good

```erb
<%= render "posts/card" %>
```

```erb
<%= render partial: "posts/card", locals: { post: @post } %>
```

```erb
<%= render partial: "admin/posts/card", collection: @posts %>
```

### 🚫 Bad

```erb
<%= render "card" %>
```

```erb
<%= render partial: "card", locals: { post: @post } %>
```

## Configuration

This rule only applies to Action View projects, so it needs `framework` to be set:

```yaml
framework: actionview
```

Disable it in `.herb.yml` when short partial names are the house style:

```yaml
linter:
  rules:
    actionview-prefer-qualified-partial-path:
      enabled: false
```

## References

- [Action View - Rendering partials](https://guides.rubyonrails.org/layouts_and_rendering.html#using-partials)
