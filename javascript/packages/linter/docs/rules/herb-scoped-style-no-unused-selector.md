# Linter Rule: No unused selector in a `<style scoped>` block

**Rule:** `herb-scoped-style-no-unused-selector`

## Description

Reports a selector in a `<style scoped>` block that matches no element in the file.

## Rationale

A `<style scoped>` block styles the file it was written in, so the selectors it holds are meant to land on that file's own markup. A selector whose class or id is nowhere in the file matches nothing and colors nothing, and the usual cause is a typo, a `.crad` where the markup says `.card`. Left in, it reads like a style that applies when it never can.

The rule matches each selector against the markup the file builds. A class or id is checked against the classes and ids the file uses, `[class~="name"]` and `[id="name"]` are read as the class or id they stand for, and an attribute selector such as `[data-controller]` is checked against the attributes the file's elements have, down to the value when it names one, so `[target="_self"]` needs an element whose `target` is `_self`. A tag selector like `a` needs an element with that tag, whether the file wrote it or an Action View helper such as `link_to` did.

A descendant (`.card a`) or child (`div > a`) combinator is walked against the element tree, so a selector that names a structure the file never contains is flagged. A class named only inside `:not()` is not treated as required.

A sibling combinator (`+`, `~`) is left alone, since the file does not carry the sibling order to check it against.

One unused selector in a list is pointed at on its own, a rule with a single unused selector is flagged with its braces, and a block of more than one rule where every rule is unused is flagged whole, so the report grows to match how much of the block does nothing.

An interpolated value is read for the part the rule can see and no more. In `class="card <%= state %>"` the `card` counts, but a class, id, or attribute that reaches the markup only through an expression is invisible, so the rule flags a selector that rests on it. The same goes for raw HTML the file emits with `raw` or `html_safe`, which a scoped block cannot scope in the first place. A rendered partial or a `yield` has its own scope and cannot carry this file's styles, so neither one holds a selector back. When a selector really is applied through markup the rule cannot see, disable the rule for that file with a `herb:disable` comment.

## Examples

### ✅ Good

```erb
<style scoped>
  .card { padding: 1rem; }
  .title { color: red; }
</style>

<div class="card">
  <h1 class="title">Hi</h1>
</div>
```

### 🚫 Bad

```erb
<style scoped>
  .crad { padding: 1rem; }
</style>

<div class="card">Hi</div>
```

## References

- [Herb Engine: scoped styles](https://herb-tools.dev/projects/engine)
