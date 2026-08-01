# Linter Rule: Avoid generic link text

**Rule:** `a11y-avoid-generic-link-text`

## Description

Avoid setting generic link text like "Click here", "Read more", and "Learn more" which do not make sense when read out of context.

## Rationale

Screen reader users often navigate by links, and generic text like "Read more", "Learn more", "Click here", "More", "Link", or "Here" is not meaningful out of context. Links should clearly describe their destination.

## Banned generic text

- `Read more`
- `Learn more`
- `Click here`
- `More`
- `Link`
- `Here`

## Examples

### ✅ Good

```erb
<a href="github.com/about">Learn more about GitHub</a>
```

```erb
<a href="github.com/new">Create a new repository</a>
```

```erb
<a aria-label="Learn more about GitHub" href="github.com/about">Learn more</a>
```

```erb
<a aria-labelledby="desc" href="github.com/about">Learn more</a>
```

### 🚫 Bad

```erb
<a href="github.com/about">Learn more</a>
```

```erb
<a href="github.com/about">Read more</a>
```

```erb
<a href="github.com/new">Click here</a>
```

```erb
<a href="github.com">More</a>
```

```erb
<a href="github.com">Link</a>
```

```erb
<a href="github.com">Here</a>
```

## References

- [erblint-github: AvoidGenericLinkText](https://github.com/github/erblint-github/blob/main/lib/erblint-github/linters/github/accessibility/avoid_generic_link_text.rb)
- [erblint-github docs](https://github.com/github/erblint-github/blob/main/docs/rules/accessibility/avoid-generic-link-text.md)
