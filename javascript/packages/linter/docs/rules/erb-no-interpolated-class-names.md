# Linter Rule: Disallow ERB interpolation inside CSS class names

**Rule:** `erb-no-interpolated-class-names`

## Description

Disallow ERB expressions that are embedded within CSS class names (e.g., `bg-<%= color %>-400`). Standalone ERB expressions that output complete class names are allowed.

## Rationale

Since tools like Tailwind CSS and [Herb's Tailwind class sorter](https://herb-tools.dev/projects/rewriter#tailwind-class-sorter) scan your source files as plain text, they have no way of understanding string interpolation. A class like `bg-<%= color %>-400` doesn't exist as a complete string anywhere in the source, so Tailwind won't generate it and the class sorter can't recognize or reorder it.

Beyond tooling, interpolated class names are also impossible to search for in editors. Searching for `bg-red-400` will never match `bg-<%= color %>-400`, making it difficult to find all usages of a class name across the codebase. Static analysis tools face the same problem since they can't determine which class names a template produces without evaluating the Ruby expression at runtime.

Instead, always use complete class names in your templates. This keeps each class name searchable, sortable, and statically analyzable.

## Examples

### ✅ Good

```erb
<div class="bg-blue-400 <%= dynamic_classes %> text-green-400"></div>
```

```erb
<div class="<%= classes %>"></div>
```

```erb
<div class="<%= a %> bg-blue-500 <%= b %>"></div>
```

```erb
<div class="<%= class_names('bg-blue-400': blue?, 'bg-red-400': red?) %>"></div>
```

```erb
<div class="<%= error? ? 'text-red-600' : 'text-green-600' %>"></div>
```

### 🚫 Bad

```erb
<div class="bg-<%= color %>-400"></div>
```

```erb
<div class="bg-<%= suffix %>"></div>
```

```erb
<div class="<%= prefix %>-blue-500"></div>
```

## References

- [Tailwind CSS: Dynamic class names](https://tailwindcss.com/docs/detecting-classes-in-source-files#dynamic-class-names)
