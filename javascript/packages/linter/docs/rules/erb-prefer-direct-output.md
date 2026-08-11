# Linter Rule: Prefer direct ERB output over string interpolation

**Rule:** `erb-prefer-direct-output`

## Description

Flags ERB output tags that contain a string literal, including interpolated strings. The text should be written directly in the template, and dynamic values should use separate ERB output tags.

## Rationale

Wrapping static text in a string literal inside an ERB output tag is unnecessary. The text can be written directly in the template. For interpolated strings, each dynamic value should use its own ERB output tag, which is more idiomatic, easier to read, and avoids unnecessary string allocation.

## Exceptions

Strings are only flagged when the text can move into the template unchanged. The cases below are left alone, since writing the text directly would change what the page renders or how the template parses.

ERB output escapes `<` and `&` while template text does not, so text containing either is not flagged. Here the ERB renders `Tom &amp; Jerry` and the text on its own would render `Tom & Jerry`:

```erb
<%= "Tom & Jerry" %>
```

Escaping also turns `"` into `&quot;`, so text containing the quote that encloses the attribute value is not flagged. Here the ERB renders `title="the &quot;good&quot; kind"`, while the text on its own would end the attribute value at the first inner quote:

```erb
<div title="<%= "the \"good\" kind" %>"></div>
```

Strings inside an unquoted attribute value, such as `<div id=<%= "#{prefix}_#{suffix}" %>>`, are not flagged either. The value ends at the first ERB tag, so the replacement would not stay part of it.

## Examples

### ✅ Good

```erb
Title
```

```erb
<%= key %>
```

```erb
<%= key %> (<%= participants.size %>)
```

```erb
Hello <%= name %>
```

### 🚫 Bad

```erb
<%= "Title" %>
```

```erb
<%= "#{key}" %>
```

```erb
<%= "#{key} (#{participants.size})" %>
```

```erb
<%= "Hello #{name}" %>
```
