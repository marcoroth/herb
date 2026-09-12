# Linter Rule: Require valid characters in attribute names

**Rule:** `html-attribute-name-valid-characters`

## Description

Warn when an HTML attribute name contains characters other than letters, digits, and hyphens, or does not start with a letter. A single colon is allowed as a namespace separator, as in `xlink:href` or `xml:lang`.

## Rationale

The HTML tokenizer accepts almost any character in an attribute name, so a browser turns `<div {{hidden}}>`, `<div (click)="go()">`, or a stray `,` between attributes into real attributes without complaint. None of them are attributes the HTML specification defines, so a conformance checker rejects them, and they usually mean a template from another language leaked into ERB or a typo split one attribute into two.

Some JavaScript frameworks give meaning to attribute names with these characters, such as `@click` and `:class` in Alpine.js and Vue, `x-on:keydown.enter` in Alpine.js, or `[value]` and `(click)` in Angular. Those names are not conforming HTML either. Disable this rule in projects that use such a framework.

Underscores are left to [`html-no-underscores-in-attribute-names`](./html-no-underscores-in-attribute-names.md).

## Examples

### ✅ Good

```erb
<div class="card" data-user-id="1" aria-label="Close"></div>
```

```erb
<svg xmlns:xlink="http://www.w3.org/1999/xlink">
  <use xlink:href="#icon"></use>
</svg>
```

```erb
<div data-<%= key %>="value"></div>
```

### 🚫 Bad

```erb
<div {{element_hidden}}></div>
```

```erb
<div class="a", id="b"></div>
```

```erb
<div [value]="name" (click)="save()"></div>
```

```erb
<div :class="{ active: isActive }" @click="toggle"></div>
```

## Configuration

Disable the rule in projects that use a framework with its own attribute syntax:

```yaml
linter:
  rules:
    html-attribute-name-valid-characters:
      enabled: false
```

## References

- [HTML Standard: Attribute name state](https://html.spec.whatwg.org/multipage/parsing.html#attribute-name-state)
- [HTML Standard: Attributes](https://html.spec.whatwg.org/multipage/syntax.html#attributes-2)
