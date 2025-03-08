---
outline: deep
---

# Blade

## Basic

### Output

::: code-group
```html [Blade]
{{ name }}
```

```json [AST]
{
  type: "blade-output",
  language: "php",
  value: {
    // PHP parser return value
  }
}
```
:::

## Helpers

### Merge attributes

::: code-group
```html [Blade]
<div {{ $attributes->merge(["data-controller" => "this-should-autocomplete"]) }}>
  {{ $message }}
</div>
```

```json [AST]
{
  type: "blade-output",
  language: "php",
  value: {
    // PHP parser return value
  }
}
```
