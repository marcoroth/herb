# Linter Rule: Prefer a single root with a scoped style block

**Rule:** `herb-scoped-style-prefer-single-root`

## Description

Prefers a single top-level element when a file has a `<style scoped>` block.

## Rationale

A `<style scoped>` block applies to the markup in the file it was written in, and every top-level element the file wrote is given the scope attribute so the block reaches all of them. Multiple roots work, but the block's territory is then implicit, spread across siblings, and the scope attribute is stamped on each one.

A single root makes the block read like a component: one element you can point at, everything scoped within it, and the attribute written once. It matches the mental model of single file components, where the styles and the one thing they style sit together.

This is a preference, so the message says prefer rather than must. A single root is not always possible or wanted. A partial that is a set of `<tr>` or `<option>` siblings, or one deliberately rendered as fragments into a slot, has a good reason to stay multi-rooted, and can silence the rule with a `herb:disable` comment. The rule only ever fires when a file has a `<style scoped>` block, and it never counts the `<style>` block itself or a sibling `<script>` as a root.

## Examples

### ✅ Good

```erb
<style scoped>
  .title { color: red; }
</style>

<div class="card">
  <h1 class="title">Hi</h1>
</div>
```

### 🚫 Bad

```erb
<style scoped>
  .title { color: red; }
</style>

<header class="title">One</header>
<main>Two</main>
<footer>Three</footer>
```

## References

- [Herb Engine: scoped styles](https://herb-tools.dev/projects/engine)
- [Vue: scoped CSS](https://vuejs.org/api/sfc-css-features.html#scoped-css)
