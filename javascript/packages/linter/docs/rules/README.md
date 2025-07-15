# Linter Rules

This page contains documentation for all Herb Linter rules.

## Available Rules

- [`erb-no-empty-tags`](./erb-no-empty-tags.md) - Disallow empty ERB tags
- [`erb-no-output-control-flow`](./erb-no-output-control-flow.md) - Prevents outputting control flow blocks
- [`erb-require-whitespace-inside-tags`](./erb-require-whitespace-inside-tags.md) - Requires whitespace around erb tags
- [`html-anchor-require-href`](./html-anchor-require-href.md) - Requires an href attribute on anchor tags
- [`html-aria-attribute-must-be-valid`](./html-aria-attribute-must-be-valid.md) - Disallow invalid or unknown `aria-*` attributes.
- [`html-aria-role-heading-requires-level`](./html-aria-role-heading-requires-level.md) - Requires `aria-level` when supplying a `role`
- [`html-aria-role-must-be-valid`](./html-aria-role-must-be-valid.md) - An `aria-level` must be a valid [WAI-ARIA Role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles)
- [`html-attribute-double-quotes`](./html-attribute-double-quotes.md) - Enforces double quotes for attribute values
- [`html-attribute-values-require-quotes`](./html-attribute-values-require-quotes.md) - Requires quotes around attribute values
- [`html-boolean-attributes-no-value`](./html-boolean-attributes-no-value.md) - Prevents values on boolean attributes
- [`html-img-require-alt`](./html-img-require-alt.md) - Requires alt attributes on img tags
- [`html-no-block-inside-inline`](./html-no-block-inside-inline.md) - Prevents block-level elements inside inline elements
- [`html-no-duplicate-attributes`](./html-no-duplicate-attributes.md) - Prevents duplicate attributes on HTML elements
- [`html-no-nested-links`](./html-no-nested-links.md) - Prevents nested anchor tags
- [`html-tag-name-lowercase`](./html-tag-name-lowercase.md) - Enforces lowercase tag names in HTML

## Contributing

To add a new linter rule you can scaffold a new rule by running:

```bash
cd javascript/packages/linter

scripts/generate-rule
```

The script creates the documentation, rule stub, and test stub based on the GitHub issue (requires the `linter` label and a `Rule name: [rule-name]` line).

Alternatively, you can create one manually:

1. Create the rule class implementing the `Rule` interface
2. Add comprehensive tests in `test/rules/`
3. Add documentation in `docs/rules/`
4. Update the main linter to include the rule by default (if appropriate)

See [`html-tag-name-lowercase.ts`](https://github.com/marcoroth/herb/blob/main/javascript/packages/linter/src/rules/html-tag-name-lowercase.ts) for an example implementation.
