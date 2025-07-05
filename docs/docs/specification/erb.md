---
outline: deep
---

# HTML+ERB

## Opening Tags

### Script Tag (`<%`)

::: code-group
```erb [ERB]
<% "String" %>
```

```json [AST]
{
  type: "erb-loud",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### Expression Tag (`<%=`)

::: code-group
```erb [ERB]
<%= "String" %>
```

```json [AST]
{
  type: "erb-loud",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### Raw text output Tag (`<%==`)

::: code-group
```erb [ERB]
<%== "String" %>
```

```json [AST]
{
  type: "erb-loud",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### Comment Tag (`<%#`)

Can also be seen as `<% #`.

::: code-group
```erb [ERB]
<%# Comment %>
```

```json [AST]
{
  type: "erb-comment",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::


### ??? Tag (`<%-`)

::: code-group
```erb [ERB]

```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### ??? Tag (`<%%`)

::: code-group
```erb [ERB]

```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::


## Closing tags

### ??? Tag (`%>`)

::: code-group
```erb [ERB]

```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### ??? Tag (`%%>`)

::: code-group
```erb [ERB]

```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### ??? Tag (`-%>`)

::: code-group
```erb [ERB]

```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::


## Attribute Value interpolation


### Interpolate attribute value

::: code-group
```erb [ERB]
<article id="<%= dom_id(article) %>"></article>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### Interpolate attribute value with static value

::: code-group
```erb [ERB]
<article class="article <%= classes_for(article) %>"></article>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::


## Attributes Interpolation

### Output

::: code-group
```erb [ERB]
<input <%= "type='text' %> />
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### Conditional

::: code-group
```erb [ERB]
<input <% if true %> type="text" <% end %> />
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::


## Conditionals

### Tag Children

::: code-group
```erb [ERB]
<% if true %>
  <h1><%= "Hello World" %></h1>
<% end %>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

## Loops

### Tag Children

::: code-group
```erb [ERB]
<% @posts.each do |post| %>
  <h1><%= post.title %></h1>
<% end %>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

## Blocks

TODO


## Rails Tag Helpers

### `content_tag`

::: code-group
```erb [ERB]
<%= content_tag(:p, "Hello world!") %>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### `tag.<tag name>`

::: code-group
```erb [ERB]
<%= tag.div tag.p("Hello world!") %>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### `tag.<tag name>` with block

::: code-group
```erb [ERB]
<%= tag.p do %>
  Hello world!
<% end %>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### `tag.<tag name>` with attributes

::: code-group
```erb [ERB]
<%= tag.section class: ["bg-black text-white"] %>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::

### `tag.attributes`

::: code-group
```erb [ERB]
<input <%= tag.attributes(type: :text, aria: { label: "Search" }) %>>
```

```json [AST]
{
  type: "erb-???",
  language: "ruby",
  value: {
    // Prism return value
  }
}
```
:::


## Disallowed

We should disallow/discourage the following patterns

### Dynamic tag names

::: code-group
```erb [ERB]
<<%= "input" %> required />
```
:::

### Dynamic Attribute names

::: code-group
```erb [ERB]
<input <%= "type" %>="text" />
```
:::
