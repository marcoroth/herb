# Linter Rule: Require `id` attribute on elements with `data-turbo-permanent`

**Rule:** `turbo-permanent-require-id`

## Description

Ensure that all HTML elements with the `data-turbo-permanent` attribute also have an `id` attribute. Without an `id`, Turbo can't track the element across page changes and the permanent behavior won't work as expected.

## Rationale

Turbo's `data-turbo-permanent` attribute marks an element to be persisted across page navigations. Turbo uses the element's `id` to match it between the current page and the new page. If no `id` is present, Turbo has no way to identify and preserve the element, so the `data-turbo-permanent` attribute has no effect.

## Examples

### ✅ Good

```erb
<div id="player" data-turbo-permanent>
  <!-- This element will persist across page navigations -->
</div>

<audio id="background-music" data-turbo-permanent>
  <source src="/music.mp3" type="audio/mpeg">
</audio>
```

### 🚫 Bad

```erb
<div data-turbo-permanent>
  <!-- Missing id: Turbo can't track this element -->
</div>

<audio data-turbo-permanent>
  <source src="/music.mp3" type="audio/mpeg">
</audio>
```

## References

- [Turbo Handbook: Persisting Elements Across Page Loads](https://turbo.hotwired.dev/handbook/building#persisting-elements-across-page-loads)
