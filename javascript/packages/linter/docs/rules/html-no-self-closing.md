# Linter Rule: Disallow self-closing tag syntax for void elements

**Rule:** `html-no-self-closing`

## Description

Disallow self-closing syntax (`<tag />`) in HTML for all elements.

In HTML5, the trailing slash in a start tag is obsolete and has no effect.
Non-void elements require explicit end tags, and void elements are
self-contained without the slash.

## Rationale

Self-closing syntax is an XHTML artifact. In HTML:

- On **non-void** elements, it’s a parse error and produces invalid markup
  (`<div />` is invalid).
- On **void elements**, the slash is ignored and unnecessary (`<input />` is
  equivalent to `<input>`).

Removing the slash ensures HTML5-compliant, cleaner markup and avoids mixing
XHTML and HTML styles.

## Exception for Email Templates

::: info
This rule is automatically disabled for ActionMailer view files (paths matching `**/views/**/*_mailer/**/*`) because older email clients, particularly legacy versions of Microsoft Outlook, require self-closing syntax for proper rendering of void elements like `<br />`.
:::

If you want to enable this rule for email templates as well, you can override the default exclusion in your `.herb.yml` configuration:

```yaml [.herb.yml]
linter:
  rules:
    html-no-self-closing:
      exclude: []  # Override to enable for all files including ActionMailer views
```

## Examples

### ✅ Good

```html
<span></span>
<div></div>
<section></section>
<custom-element></custom-element>

<img src="/logo.png" alt="Logo">
<input type="text" autocomplete="off">
<br>
<hr>
```

### 🚫 Bad

```html
<span />

<div />

<section />

<custom-element />

<img src="/logo.png" alt="Logo" />

<input type="text" autocomplete="off" />

<br />

<hr />
```

## References

- [HTML Living Standard: Void Elements](https://html.spec.whatwg.org/multipage/syntax.html#void-elements)
- [MDN: Void element](https://developer.mozilla.org/en-US/docs/Glossary/Void_element)
- [erb_lint: SelfClosingTag](https://github.com/Shopify/erb_lint#selfclosingtag)
