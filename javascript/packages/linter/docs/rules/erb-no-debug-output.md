# Linter Rule: Disallow debug output methods in ERB templates

**Rule:** `erb-no-debug-output`

## Description

This rule disallows using `p`, `pp`, `puts`, `print`, `warn`, `debug`, `byebug`, `binding.pry`, and `binding.irb` in ERB templates. These are debug output methods and debugger breakpoints that should not appear in production templates.

## Rationale

Debug output methods like `p`, `pp`, `puts`, `print`, `warn`, and `debug` are commonly used during development to inspect values, and debugger breakpoints like `byebug`, `binding.pry`, and `binding.irb` are used to pause execution. All of these should be removed before committing code. In ERB templates, `p`, `pp`, `puts`, `print`, and `warn` bypass the rendering pipeline and write directly to stdout/stderr, while `debug` renders a YAML dump into the HTML. None of these should appear in production templates.

Use `<%= ... %>` to display content in the rendered HTML, or use proper logging (e.g., `Rails.logger`) for debugging purposes.

## Examples


### ✅ Good

```erb
<%= @user.name %>
```

### 🚫 Bad

```erb
<% puts "hello" %>
```

```erb
<% p @user %>
```

```erb
<% pp @user %>
```

```erb
<% print "debug" %>
```

```erb
<%= puts "value" %>
```

```erb
<% warn "something went wrong" %>
```

```erb
<%= debug @user %>
```

```erb
<% byebug %>
```

```erb
<% binding.pry %>
```

```erb
<% binding.irb %>
```

## References

- [`Kernel#puts`](https://ruby-doc.org/core/Kernel.html#method-i-puts)
- [`Kernel#p`](https://ruby-doc.org/core/Kernel.html#method-i-p)
- [`Kernel#pp`](https://ruby-doc.org/core/Kernel.html#method-i-pp)
- [`Kernel#print`](https://ruby-doc.org/core/Kernel.html#method-i-print)
- [`Kernel#warn`](https://ruby-doc.org/core/Kernel.html#method-i-warn)
- [`ActionView::Helpers::DebugHelper`](https://api.rubyonrails.org/classes/ActionView/Helpers/DebugHelper.html)
- [`byebug`](https://github.com/deivid-rodriguez/byebug)
- [`binding.pry`](https://github.com/pry/pry)
- [`binding.irb`](https://ruby-doc.org/stdlib/libdoc/irb/rdoc/IRB.html)
