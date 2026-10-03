---
outline: deep
---

# `AutoCloseOmittedTagsVisitor`

Makes sure the compiled output always contains a closing tag, even when the template omits it.

Given this template:

```html+erb
<ul>
  <li>List Item 1
  <li>List Item 2
</ul>
```

The engine renders:

```html
<ul>
  <li>List Item 1
  </li><li>List Item 2
</li></ul>
```

The closing tag is inserted where the parser determined the element ends, which keeps the surrounding whitespace (and therefore the rendering of `inline-block` elements) identical to the template without the visitor.
