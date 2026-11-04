# Linter Rule: Disallow Ruby comments at the end of ERB tags

**Rule:** `erb-no-trailing-comment`

## Description

Disallow Ruby line comments that run all the way to the closing `%>` of an ERB tag, such as `<%= foo # comment %>`.

A comment inside a tag is allowed when it is followed by a newline inside the tag. ERB comment tags (`<%# %>`) are not affected. Tags that contain only a comment, such as `<% # comment %>`, are covered by [`erb-comment-syntax`](./erb-comment-syntax.md).

## Rationale

ERB and Erubi compile a template by appending the code of each tag to the generated Ruby source, followed by the code for the rest of the template. When a Ruby line comment runs up to the end of a tag, it also comments out that appended code, because it ends up on the same line. The result is a `SyntaxError`, or the rest of the template is silently dropped.

```erb
<%= I18n.t("Hello") # comment %>
```

```ruby
# The closing parenthesis is commented out, so this raises a SyntaxError
_buf << ( I18n.t("Hello") # comment ).to_s;
```

```erb
<% name = "World" # comment %>Hello, <%= name %>!
```

```ruby
# The code is still valid, but "Hello, World!" is never rendered
name = "World" # comment ; _buf << 'Hello, '.freeze; _buf << ( name ).to_s; _buf << '!'.freeze;
```

`Herb::Engine` handles trailing comments when it compiles a template, so this rule does not report anything when `template_engine` is set to `herb` in `.herb.yml`.

## Autofix

This rule provides an **unsafe** autofix that moves the comment into a separate `<%# %>` tag right after the original tag. The autofix is considered unsafe because two tags on one line are trimmed differently than a single tag: when a `<% %>` tag is the only thing on its line, Erubi removes the line's indentation and trailing newline, but it doesn't do that for a line with two tags.

```erb
<%= I18n.t("Hello") # comment %>
```

```erb
<%= I18n.t("Hello") %><%# comment %>
```

The autofix is not applied to templates that have parse errors, such as `<% if some_method # comment %><% end %>`, or to tags that contain only a comment.

## Examples

### ✅ Good

```erb
<%= I18n.t("Hello") %><%# comment %>

<%# comment %>
<% name = "World" %>Hello, <%= name %>!

<%
  name = "World" # comment
%>Hello, <%= name %>!
```

### 🚫 Bad

```erb
<%= I18n.t("Hello") # comment %>

<% name = "World" # comment %>Hello, <%= name %>!

<% if some_method # comment %><% end %>
```

## Configuration

This rule doesn't report anything when the project renders its templates with `Herb::Engine`:

```yaml
template_engine: herb
```
