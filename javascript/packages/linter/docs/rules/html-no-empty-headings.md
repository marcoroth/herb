# Linter Rule: Disallow empty headings

### Rule: `html-no-empty-headings`

##### Description

Disallow headings (h1, h2, etc.) with no accessible text content.

##### Rationale

Headings relay the structure of a webpage and provide a meaningful, hierarchical order of its content. If headings are empty or its text contents are inaccessible, this could confuse users or prevent them accessing sections of interest.

#### Examples

##### ✅ Good

```html+erb
<h*>Heading Content</h*>
```

```html+erb
<h*><span>Text</span><h*>
```

```html+erb
<div role="heading" aria-level="1">Heading Content</div>
```

```html+erb
<h* aria-hidden="true">Heading Content</h*>
```

```html+erb
<h* hidden>Heading Content</h*>
```

##### 🚫 Bad

```html+erb
<h*></h*>
```

```html+erb
<div role="heading" aria-level="1"></div>
```

```html+erb
<h*><span aria-hidden="true">Inaccessible text</span></h*>
```

#### References

- [`<h1>`–`<h6>`: The HTML Section Heading elements](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/Heading_Elements)
- [ARIA: `heading` role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/heading_role)
- [ARIA: `aria-hidden` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden)
- [ARIA: `aria-level` attribute](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-level)

Inspired by [ember-template-lint](https://github.com/ember-template-lint/ember-template-lint/blob/master/docs/rule/no-empty-headings.md)
