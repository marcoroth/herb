# Linter Rule: Disallow bad ERB comment syntax.

## Rule: `erb-comment-syntax`

Bad ERB comment syntax. Leaving a space between ERB tags and the Ruby comment character can cause parser errors.

## Examples

### ❌ Incorrect

```erb
<% # some bad ruby comment that should be changed to erb one line comment %>
```

### ✅ Correct

```erb
<% 
 # some good multi line ruby comment
 # some good multi line ruby comment
 # some good multi line ruby comment
 # some good multi line ruby comment
%>
<%# some good erb comment %>
<% 
 # some good ruby comment 
%>
```

## Configuration

This rule has no configuration options.
