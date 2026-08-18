# Linter Rule: Disallow class definitions in ERB templates

**Rule:** `erb-no-class-definitions`

## Description

Disallow defining Ruby `class` structures inside ERB templates. View files should only contain rendering logic, not class definitions. Defining classes in ERB breaks separation of concerns and introduces maintainability risks.

## Rationale

Defining classes inside a template:

- Pollutes the global or view namespace
- Makes behavior hard to test or reuse
- Cannot be autoloaded or organized conventionally
- Violates MVC boundaries in Rails
- May cause unpredictable behavior if the template is rendered multiple times

Templates are not an appropriate place for defining classes. Move them to helpers, models, or view objects.

## Examples

### ✅ Good

```ruby
# app/components/badge_component.rb
class BadgeComponent
  def render
    %(<span class="badge">NEW</span>).html_safe
  end
end
```

```erb
<%= BadgeComponent.new.render %>
```

### 🚫 Bad

```erb
<%
  class BadgeComponent
    def render
      %(<span class="badge">NEW</span>).html_safe
    end
  end
%>

<%= BadgeComponent.new.render %>
```
