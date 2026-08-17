# Linter Rule: Disallow module definitions in ERB templates

**Rule**:`erb-no-module-definitions`

## Description

Disallow defining Ruby `module` structures and calling `Module.new` inside ERB templates. Like class definitions, modules introduce architectural logic that belongs in helper files, libraries, or initializers, not in view templates.

## Rationale

Defining a module in an ERB file:

- Violates separation of concerns
- Pollutes the global or view context
- Cannot be autoloaded, extended, or reused properly
- Makes templates harder to read and debug
- Can introduce unpredictable state when templates are re-rendered

Move modules to their appropriate locations in `app/helpers/`, `app/`, `lib/`, or other structural Ruby files.

## Examples

### ✅ Good

```ruby
# app/helpers/display_helpers.rb

module DisplayHelpers
  def item_count(count)
    pluralize(count, "item")
  end
end
```

```erb
<%= item_count(2) %>
```

### 🚫 Bad

```erb
<%
  module DisplayHelpers
    def item_count(count)
      pluralize(count, "item")
    end
  end
%>

<%= item_count(2) %>
```

```erb
<%
  decorator = Module.new do
    def item_count(count)
      pluralize(count, "item")
    end
  end
%>
```
