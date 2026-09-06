# Linter Rule: Validate component structure and attributes in slots templates

**Rule:** `herb-slots-valid-components`

## Description

Validates the built-in component tags in a template that declares `herb:slots`. A `<Fragment>` needs exactly one `<Fallback>`, a `<Fallback>` belongs directly inside a component, attributes must be ones the component takes, timing attributes take whole milliseconds, and a deferred block cannot sit inside a collection.

## Rationale

The engine's slots visitor reports these same problems as compile diagnostics, so they surface in the dev tools once the page runs. This rule reports them in the editor, using the same messages, before the page runs at all, the same arrangement `herb-state-valid-actions` has with the runtime.

The checks mirror the engine. `<Fragment>` takes `delay`, `hold` and `on`, the deferred blocks `<Async>` and `<Lazy>` also take `poll`, and `<Fallback>` takes no attributes yet. A `<Fallback>` counts only as a direct child of its component, a `<Fragment>` cannot sit directly inside a `<Fallback>`, and an unknown capitalized name is reported the way the engine reports it. One engine warning stays engine-only, the one saying a fallback can never appear, since deciding it needs the server-read analysis only the compiler has.

Templates without a `herb:slots` directive are left to `herb-component-requires-slots`.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>

<Fragment delay="0" hold="600">
  <p><%= Geo.locate(city) %></p>
  <Fallback><p class="pulse">Looking it up</p></Fallback>
</Fragment>
```

### 🚫 Bad

```erb
<%# herb:slots client %>

<Fragment delay="fast" id="card">
  <p><%= Geo.locate(city) %></p>
  <Fallback class="pulse"><p>Looking it up</p></Fallback>
  <Fallback><p>Still looking</p></Fallback>
</Fragment>
```

## References

- [`herb-component-requires-slots`](./herb-component-requires-slots.md)
- [`herb-state-valid-actions`](./herb-state-valid-actions.md)
