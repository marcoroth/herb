# Linter Rule: Require explicit closing tags

**Rule:** `html-require-closing-tags`

## Description

Disallow the omission of optional closing tags for HTML elements where the closing tag is technically optional according to the HTML specification. This rule flags elements that have an `HTMLOmittedCloseTagNode` as their close tag.

## Rationale

While HTML allows certain closing tags to be omitted (implicitly closed by sibling elements or parent closing), explicit closing tags improve code readability and maintainability. They make the document structure clear at a glance and reduce ambiguity about where elements end.

Explicit closing tags also:

- Make templates easier to understand for developers unfamiliar with HTML's implicit closing rules
- Reduce potential for subtle bugs when refactoring or moving code
- Improve consistency across the codebase
- Make diffs cleaner when adding content to elements

## Elements with Optional Closing Tags

This rule would flag elements that have omitted closing tags:

- `<li>` - list items
- `<dt>`, `<dd>` - definition list terms and descriptions
- `<p>` - paragraphs
- `<option>`, `<optgroup>` - select options and groups
- `<thead>`, `<tbody>`, `<tfoot>` - table sections
- `<tr>` - table rows
- `<td>`, `<th>` - table cells
- `<colgroup>` - table column groups
- `<rt>`, `<rp>` - ruby annotations

## Examples

### ✅ Good

Explicit closing tags:

```erb
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ul>
```

```erb
<dl>
  <dt>Term 1</dt>
  <dd>Definition 1</dd>
  <dt>Term 2</dt>
  <dd>Definition 2</dd>
</dl>
```

```erb
<table>
  <thead>
    <tr>
      <th>Header 1</th>
      <th>Header 2</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Cell 1</td>
      <td>Cell 2</td>
    </tr>
  </tbody>
</table>
```

```erb
<select>
  <option>Option 1</option>
  <option>Option 2</option>
  <option>Option 3</option>
</select>
```

```erb
<div>
  <p>Paragraph 1</p>
  <p>Paragraph 2</p>
</div>
```

### 🚫 Bad

Omitted closing tags (implicitly closed):

```erb
<ul>
  <li>Item 1
  <li>Item 2
  <li>Item 3
</ul>
```

```erb
<dl>
  <dt>Term 1
  <dd>Definition 1
  <dt>Term 2
  <dd>Definition 2
</dl>
```

```erb
<table>
  <thead>
    <tr>
      <th>Header 1
      <th>Header 2
  <tbody>
    <tr>
      <td>Cell 1
      <td>Cell 2
</table>
```

```erb
<select>
  <option>Option 1
  <option>Option 2
  <option>Option 3
</select>
```

```erb
<div>
  <p>Paragraph 1
  <p>Paragraph 2
</div>
```

## References

- [HTML Spec: Optional Tags](https://html.spec.whatwg.org/multipage/syntax.html#optional-tags)
- [HTML Spec: Tag Omission](https://html.spec.whatwg.org/multipage/dom.html#concept-element-tag-omission)
- [CSS-Tricks: Fighting the Space Between Inline Block Elements](https://css-tricks.com/fighting-the-space-between-inline-block-elements/)
