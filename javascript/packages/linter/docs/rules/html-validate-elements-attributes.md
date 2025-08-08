# Linter Rule: Validate HTML elements and attributes

**Rule:** `html-validate-elements-attributes`

## Description

Validates HTML elements and their attributes against the HTML specification, including comprehensive attribute value validation.

This rule checks whether HTML elements are valid, whether attributes are allowed on specific elements, and whether attribute values match their expected types and formats. When ERB is present in attribute values, the rule skips value validation but still validates that the attribute name itself is valid for the element.

## Rationale

Validating HTML elements and attributes helps catch common errors that can lead to invalid HTML that may not render correctly across browsers, accessibility issues from malformed attributes, SEO problems from incorrect meta tags or link relationships, security vulnerabilities from improperly formatted URLs or IDs, and development confusion from typos in element or attribute names. By enforcing HTML specification compliance, this rule ensures your templates generate valid, accessible, and maintainable HTML.

## Examples

### ✅ Good

```erb
<!-- Valid HTML elements and attributes -->
<div id="container" class="main header-nav"></div>
<a href="/home" target="_blank" rel="noopener noreferrer">Link</a>
<img src="/logo.png" alt="Logo" width="100" height="50">

<!-- Valid attribute values -->
<input type="email" required autocomplete="email">
<form method="post" enctype="multipart/form-data">
<button type="submit" disabled>Submit</button>
<script type="module" src="/app.js" async defer></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<!-- Custom elements are allowed -->
<my-component custom-attr="value"></my-component>

<!-- data-* and aria-* attributes are allowed -->
<div data-user-id="123" data-role="admin"></div>
<button aria-label="Close" aria-expanded="false">X</button>

<!-- ERB values skip VALUE validation but attribute names are still validated -->
<div class="<%= dynamic_class %>">Content</div>
```

### 🚫 Bad

```erb
<invalidtag>Content</invalidtag>


<div href="/link">Not a link</div>

<span placeholder="Enter text"></span>


<input type="invalid-type">

<input required="false">

<a href="not a valid url">Link</a>

<input tabindex="not-a-number">

<input tabindex="-5">

<div class="123invalid">Content</div>

<label for="123invalid">Label</label>

<form method="invalid">

<button type="invalid">Button</button>

<div some-attr="<%= dynamic_value %>">Content</div>
```

## References

* [HTML Living Standard](https://html.spec.whatwg.org/)
* [MDN HTML Elements Reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Element)
* [MDN HTML Attributes Reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes)
* [W3C HTML Specification](https://www.w3.org/TR/html52/)
