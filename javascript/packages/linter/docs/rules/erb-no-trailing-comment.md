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

These offenses are reported as errors.

A `<% %>` tag that is the only thing on its line is the exception. Erubi trims such a line, so the line's trailing newline becomes part of the tag's code and ends the comment before the code that follows. This is how Rails compiles templates by default, so the template below renders correctly.

```erb
<% if some_method %>
  Hello
<% end # if some_method %>
Goodbye
```

```ruby
# The newline after the comment ends it, so "Goodbye" is still rendered
if some_method
 _buf << '  Hello
'.freeze; end # if some_method
 _buf << 'Goodbye
'.freeze;
```

The comment still breaks the template as soon as anything else is added to that line, and it breaks under an engine that doesn't trim the line. This rule reports these tags as warnings.

`Herb::Engine` handles trailing comments when it compiles a template. When `template_engine` is set to `herb` in `.herb.yml`, this rule reports every trailing comment as a warning, because none of them break rendering.

## Autofix

This rule provides an autofix that moves the comment into a separate `<%# %>` tag right after the original tag.

```erb
<%= I18n.t("Hello") # comment %>
```

```erb
<%= I18n.t("Hello") %><%# comment %>
```

The autofix is **unsafe** for a `<% %>` tag that is the only thing on its line. Erubi removes the indentation and trailing newline of such a line, but it doesn't do that for a line with two tags, so the rendered whitespace changes. For every other tag the line wasn't trimmed before the fix and isn't trimmed after it, so the autofix is safe.

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

### ⚠️ Warning

```erb
<% if some_method %>
  Hello
<% end # if some_method %>
```

## Configuration

This rule reports every trailing comment as a warning when the project renders its templates with `Herb::Engine`:

```yaml
template_engine: herb
```

The rule's `severity` setting only applies to the offenses that break rendering. The other offenses are always reported as warnings.
