# Linter Rule: No abstract ARIA roles

**Rule:** `html-no-abstract-roles`

## Description

Prevent usage of WAI-ARIA abstract roles in the `role` attribute.

## Rationale

The WAI-ARIA specification defines a set of abstract roles that are used to support the ARIA Roles Model for the purpose of defining general role concepts.

Abstract roles are used for the ontology only. They exist to help organize the hierarchy of roles and define shared characteristics, but they are not meant to be used by authors directly. Using abstract roles in content provides no semantic meaning to assistive technologies and can lead to accessibility issues.

Authors **MUST NOT** use abstract roles in content. Instead, use one of the concrete roles that inherit from these abstract roles. For example, use `button` instead of `command`, or `navigation` instead of `landmark`.

The following abstract roles must not be used:

- `command`
- `composite`
- `input`
- `landmark`
- `range`
- `roletype`
- `section`
- `sectionhead`
- `select`
- `structure`
- `widget`
- `window`

## Examples

### ✅ Good

```erb
<div role="button">Push it</div>
```

```erb
<nav role="navigation">Menu</nav>
```

```erb
<div role="alert">Warning!</div>
```

```erb
<div role="slider" aria-valuenow="50">Volume</div>
```

### 🚫 Bad

```erb
<div role="window">Hello, world!</div>
```

```erb
<div role="widget">Content</div>
```

```erb
<div role="command">Action</div>
```

```erb
<div role="landmark">Navigation</div>
```

## References

- [WAI-ARIA 1.0: Abstract Roles](https://www.w3.org/TR/wai-aria-1.0/roles#abstract_roles)
- [WAI-ARIA 1.2: Abstract Roles](https://www.w3.org/TR/wai-aria-1.2/#abstract_roles)
- [ember-template-lint: no-abstract-roles](https://github.com/ember-template-lint/ember-template-lint/blob/main/docs/rule/no-abstract-roles.md)
