# Linter Rule: One `<style scoped>` block per file

**Rule:** `herb-scoped-style-single-declaration`

## Description

Requires a file to declare its scoped styles in a single `<style scoped>` block.

## Rationale

A `<style scoped>` block styles the file it was written in, and the engine collects several blocks in one file under the same scope without complaint, so splitting a file's scoped styles across blocks changes nothing about how the page renders. What it changes is how the file reads. A block is the one place a file's scoped styles live, and a reader who finds one reasonably stops looking. A second block further down quietly widens the file's styles behind their back.

A nested block is counted too, so a second block hidden inside the markup is reported the same as one at the top.

## Examples

### ✅ Good

```erb
<style scoped>
  .title { color: red; }
  .card { padding: 1rem; }
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

<div class="card">
  <h1 class="title">Hi</h1>
</div>

<style scoped>
  .card { padding: 1rem; }
</style>
```

## References

- [Herb Engine: scoped styles](https://herb-tools.dev/projects/engine)
