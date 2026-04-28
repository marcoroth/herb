# Linter Rule: No `accesskey` attribute

**Rule:** `a11y-no-accesskey-attribute`

## Description

Enforce no `accesskey` attribute on elements. Access keys are HTML attributes that allow web developers to assign keyboard shortcuts to elements.

## Rationale

Inconsistencies between keyboard shortcuts and keyboard commands used by screen readers and keyboard-only users create accessibility complications. To avoid these complications, access keys should not be used.

## Examples

### ✅ Good

```erb
<div></div>
```

```erb
<a href="/about">About</a>
```

```erb
<%= link_to "About", "/about", class: "link" %>
```

```erb
<%= tag.div class: "container" %>
```

### 🚫 Bad

```erb
<div accesskey="h"></div>
```

```erb
<a href="/about" accesskey="a">About</a>
```

```erb
<%= link_to "About", "/about", accesskey: "a" %>
```

```erb
<%= tag.div accesskey: "h" %>
```

```erb
<%= content_tag :div, "content", accesskey: "h" %>
```

## References

- [MDN: accesskey](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/accesskey)
- [WebAIM: Accesskey](https://webaim.org/techniques/keyboard/accesskey)
- [ember-template-lint: no-accesskey-attribute](https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/no-accesskey-attribute.md)
