---
outline: deep
---

# HTML

## Tags

### Regular tags (closed)

::: code-group
```html [HTML]
<div></div>
```

```json [AST]
{
  type: "element",
  tagName: "div",
  attributes: [],
  children: [],
  void: false,
  closed: true
}
```
:::

### Regular tags (open)

::: code-group
```html [HTML]
<div>
```

```json [AST]
{
  type: "element",
  tagName: "div",
  attributes: [],
  children: [],
  void: false,
  closed: false
}
```
:::

### Self-closing tags

::: code-group
```html [HTML]
<img />
```

```json [AST]
{
  type: "element",
  tagName: "img",
  attributes: [],
  children: [],
  void: true,
  closed: true
}
```
:::

::: code-group
```html [HTML]
<div />
```

```json [AST]
{
  type: "element",
  tagName: "div",
  attributes: [],
  children: [],
  void: true,
  closed: true
}
```
:::


### Namespaced tags

::: code-group
```html [HTML]
<ns:table></ns:table>
```

```json [AST]
{
  type: "element",
  tagName: "ns:table",
  attributes: [],
  children: [],
  void: true,
  closed: true,
  namespaced: true // maybe?
}
```
:::

## Attributes

### Double quoted attribute

::: code-group
```html [HTML]
<input class="input input-text" />
```

```json [AST]
{
  type: "element",
  tagName: "input",
  attributes: [
    {
      type: "attribute",
      name: "class",
      value: "input input-type",
      quote: "double"
    }
  ],
  children: [],
  void: true,
  closed: true
}
```
:::

### Single quoted attribute

::: code-group
```html [HTML]
<input class='input input-text' />
```

```json [AST]
{
  type: "element",
  tagName: "input",
  attributes: [
    {
      type: "attribute",
      name: "class",
      value: "input input-type",
      quote: "single"
    }
  ],
  children: [],
  void: true,
  closed: true
}
```
:::

### None-quoted attribute

::: code-group
```html [HTML]
<input class=input />
```

```json [AST]
{
  type: "element",
  tagName: "input",
  attributes: [
    {
      type: "attribute",
      name: "class",
      value: "input",
      quote: "none"
    }
  ],
  children: [],
  void: true,
  closed: true
}
```
:::

### Empty attribute

::: code-group
```html [HTML]
<div class=""></div>
```

```json [AST]
{
  type: "element",
  tagName: "input",
  attributes: [
    {
      type: "attribute",
      name: "class",
      value: "",
      quote: "double"
    }
  ],
  children: [],
  void: true,
  closed: true
}
```
:::

### Boolean attribute

::: code-group
```html [HTML]
<input required />
```

```json [AST]
{
  type: "element",
  tagName: "input",
  attributes: [
    {
      type: "attribute",
      name: "required",
      value: true
    }
  ],
  children: [],
  void: true,
  closed: true
}
```
:::

## Content

### No content

::: code-group
```html [HTML]
<h1></h1>
```

```json [AST]
{
  type: "element",
  tagName: "h1",
  attributes: [],
  children: [],
  void: false,
  closed: true
}
```
:::

### Text content

::: code-group
```html [HTML]
<h1>Title</h1>
```

```json [AST]
{
  type: "element",
  tagName: "h1",
  attributes: [],
  children: [
    {
      type: "text",
      value: "Title"
    }
  ],
  void: false,
  closed: true
}
```
:::

### HTML tags

::: code-group
```html [HTML]
<h1>
  <span>Title</span>
</h1>
```

```json [AST]
{
  type: "element",
  tagName: "h1",
  attributes: [],
  children: [
    {
      type: "element",
      tagName: "span",
      attributes: [],
      children: [
        {
          type: "text",
          value: "Title"
        }
      ],
      void: false,
      closed: true
    }
  ],
  void: false,
  closed: true
}
```
:::

### HTML tags + Text content

::: code-group
```html [HTML]
<h1>
  Version
  <sup>1.0</sup>
</h1>
```

```json [AST]
{
  type: "element",
  tagName: "h1",
  attributes: [],
  children: [
    {
      type: "text",
      value: "Version"
    },
    {
      type: "element",
      tagName: "sub",
      attributes: [],
      children: [
        {
          type: "text",
          value: "1.0"
        }
      ],
      void: false,
      closed: true
    }
  ],
  void: false,
  closed: true
}
```
:::


## Comments

### Regular

::: code-group
```html [HTML]
<!-- Comment -->
```

```json [AST]
{
  type: "comment",
  value: " Comment "
}
```
:::


### Multi-line


::: code-group
```html [HTML]
<!--
  Comment
  On
  Muliple
  Lines
-->
```

```json [AST]
{
  type: "comment",
  value: "  Comment\n  On\  Multiple\n  Lines"
}
```
:::
