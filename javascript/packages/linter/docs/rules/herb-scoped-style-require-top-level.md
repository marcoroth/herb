# Linter Rule: Require a top-level `<style scoped>` block

**Rule:** `herb-scoped-style-require-top-level`

## Description

Requires a `<style scoped>` block to be a top-level element of the file.

## Rationale

A `<style scoped>` block styles the whole file it was written in, wherever it sits. Nesting one inside an element suggests it scopes to that element, the way it would in a framework that scopes by component boundary. It does not: the scope is still the file. Keeping the block at the top level makes where it sits read like what it applies to, and removes the misreading.

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
<div class="card">
  <style scoped>
    .title { color: red; }
  </style>

  <h1 class="title">Hi</h1>
</div>
```

## References

- [Herb Engine: scoped styles](https://herb-tools.dev/projects/engine)
