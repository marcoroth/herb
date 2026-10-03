# Linter Rule: Enforce consistent closing ERB tag indentation

**Rule:** `erb-closing-tag-indent`

## Description

Enforce where the closing `%>` of an ERB tag sits. A tag holding a single line of Ruby belongs on one line. A tag whose code spans several lines either opens with a newline and closes with `%>` alone on the last line, indented to the column of its opening tag, or keeps `%>` at the end of the last line of code.

The rule does not touch whitespace trimming tags (`<%-`, `-%>` and `=%>`), ERB comments, tags carrying a Ruby comment, or ERB inside an HTML open tag.

## Rationale

When an ERB tag spans lines, a closing `%>` that lines up with its opening tag shows where the tag ends without reading the Ruby in between. When it does not span lines, the three parts read as one expression and splitting them costs two lines for nothing.

`herb format` already positions the closing tag this way, so every offense this rule reports is one `herb format` would have fixed too, and `herb lint --fix` produces the same output the formatter does. The rule exists for projects that lint without formatting.

Some shapes are left alone because moving the closing tag there changes more than layout. Whitespace trimming tags are placed deliberately, and the trim markers interact with the surrounding newlines.

The rest come down to ERB putting generated code after the last line of a tag. A heredoc terminator has to be alone on its line, a Ruby comment swallows everything that follows it, and `=begin` and `=end` only count at the start of a line. Pulling the closing tag up to any of those turns a working template into a syntax error, so tags carrying one keep the layout they have.

## Examples

### ✅ Good

A single line of Ruby on one line:

```erb
<%= title %>
```

```erb
<% if admin? %>
  <h1>Content</h1>
<% end %>
```

Code spanning several lines, with `%>` lined up under the opening tag:

```erb
<%=
  some_helper(
    argument,
    other_argument
  )
%>
```

Code spanning several lines that opens inline, with `%>` at the end of the last line:

```erb
<%= some_helper(
  argument,
  other_argument
) %>
```

A heredoc, where `%>` has to follow the terminator on its own line:

```erb
<%= description(<<~TEXT)
  hello
TEXT
%>
```

### 🚫 Bad

A single line of Ruby split across three lines:

```erb
<%=
  title
%>
```

```erb
<% if admin?
%>
  <h1>Content</h1>
<% end %>
```

Code spanning several lines with `%>` left on the last line of code:

```erb
<%=
  some_helper(
    argument,
    other_argument
  ) %>
```

Code spanning several lines with `%>` on its own line but out of line with the opening tag:

```erb
<%=
  some_helper(
    argument,
    other_argument
  )
  %>
```

Code spanning several lines that opens inline but closes on its own line:

```erb
<%= some_helper(
  argument,
  other_argument
)
%>
```

## References

- [Inspiration: ERB Lint `ClosingErbTagIndent` rule](https://github.com/Shopify/erb_lint/blob/main/lib/erb_lint/linters/closing_erb_tag_indent.rb)
