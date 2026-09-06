# Linter Rule: Require a `herb:slots` directive on templates using component tags

**Rule:** `herb-component-requires-slots`

## Description

Requires a template that uses component tags like `<Fragment>` or `<Fallback>` to opt into slots compilation with a `<%# herb:slots %>` directive.

## Rationale

Components only compile when the template declares slots. Without the directive the engine leaves the tags in place, the browser treats them as unknown elements, and a `<Fallback>` renders alongside the content it should replace, with no deferral and no swapping. Nothing else surfaces this, because `html-tag-name-lowercase` deliberately skips component-cased names.

The rule flags any tag written in component case, an uppercase start on a name that is not a known HTML element, since nothing compiles those in a slots template either and the engine reports them there. Custom elements are unaffected, as their names are lowercase with a hyphen. XML templates are exempt, both by an `<?xml ?>` declaration and by an `.xml.erb` file name, since uppercase tags are ordinary there.

## Examples

### ✅ Good

```erb
<%# herb:slots client %>

<Fragment>
  <p><%= Geo.locate(city) %></p>
  <Fallback><p class="pulse">Looking it up</p></Fallback>
</Fragment>
```

```erb
<div class="card"><my-widget></my-widget></div>
```

### 🚫 Bad

```erb
<Fragment>
  <p><%= Geo.locate(city) %></p>
  <Fallback><p class="pulse">Looking it up</p></Fallback>
</Fragment>
```

## References

- [`herb-state-requires-client-mode`](./herb-state-requires-client-mode.md)
