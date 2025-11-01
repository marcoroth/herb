# Linter Rules

This page contains documentation for all Herb Linter rules.

## Available Rules

- [`erb-comment-syntax`](./erb-comment-syntax.md) - Disallow Ruby comments immediately after ERB tags
- [`erb-no-case-node-children`](./erb-no-case-node-children.md) - Don't use `children` for `case/when` and `case/in` nodes
- [`erb-no-empty-tags`](./erb-no-empty-tags.md) - Disallow empty ERB tags
- [`erb-no-extra-newline`](./erb-no-extra-newline.md) - Disallow extra newlines.
- [`erb-no-extra-whitespace-inside-tags`](./erb-no-extra-whitespace-inside-tags.md) - Disallow multiple consecutive spaces inside ERB tags
- [`erb-no-output-control-flow`](./erb-no-output-control-flow.md) - Prevents outputting control flow blocks
- [`erb-no-silent-tag-in-attribute-name`](./erb-no-silent-tag-in-attribute-name.md) - Disallow ERB silent tags in HTML attribute names
- [`erb-prefer-image-tag-helper`](./erb-prefer-image-tag-helper.md) - Prefer `image_tag` helper over `<img>` with ERB expressions
- [`erb-require-whitespace-inside-tags`](./erb-require-whitespace-inside-tags.md) - Requires whitespace around ERB tags
- [`erb-require-trailing-newline`](./erb-require-trailing-newline.md) - Enforces that all HTML+ERB template files end with exactly one trailing newline character.
- [`erb-right-trim`](./erb-right-trim.md) - Enforce consistent right-trimming syntax.
- [`herb-disable-comment-malformed`](./herb-disable-comment-malformed.md) - Detect malformed `herb:disable` comments.
- [`herb-disable-comment-missing-rules`](./herb-disable-comment-missing-rules.md) - Require rule names in `herb:disable` comments.
- [`herb-disable-comment-no-duplicate-rules`](./herb-disable-comment-no-duplicate-rules.md) - Disallow duplicate rule names in `herb:disable` comments.
- [`herb-disable-comment-no-redundant-all`](./herb-disable-comment-no-redundant-all.md) - Disallow redundant use of `all` in `herb:disable` comments.
- [`herb-disable-comment-unnecessary`](./herb-disable-comment-unnecessary.md) - Detect unnecessary `herb:disable` comments.
- [`herb-disable-comment-valid-rule-name`](./herb-disable-comment-valid-rule-name.md) - Validate rule names in `herb:disable` comments.
- [`html-anchor-require-href`](./html-anchor-require-href.md) - Requires an href attribute on anchor tags
- [`html-aria-attribute-must-be-valid`](./html-aria-attribute-must-be-valid.md) - Disallow invalid or unknown `aria-*` attributes.
- [`html-aria-label-is-well-formatted`](./html-aria-label-is-well-formatted.md) - `aria-label` must be well-formatted
- [`html-aria-level-must-be-valid`](./html-aria-level-must-be-valid.md) - `aria-level` must be between 1 and 6
- [`html-aria-role-heading-requires-level`](./html-aria-role-heading-requires-level.md) - Requires `aria-level` when supplying a `role`
- [`html-aria-role-must-be-valid`](./html-aria-role-must-be-valid.md) - The `role` attribute must have a valid WAI-ARIA Role.
- [`html-attribute-double-quotes`](./html-attribute-double-quotes.md) - Enforces double quotes for attribute values
- [`html-attribute-equals-spacing`](./html-attribute-equals-spacing.md) - No whitespace around `=` in HTML attributes
- [`html-attribute-values-require-quotes`](./html-attribute-values-require-quotes.md) - Requires quotes around attribute values
- [`html-avoid-both-disabled-and-aria-disabled`](./html-avoid-both-disabled-and-aria-disabled.md) - Avoid using both `disabled` and `aria-disabled` attributes
- [`html-body-only-elements`](./html-body-only-elements.md) - Require content elements inside `<body>`.
- [`html-boolean-attributes-no-value`](./html-boolean-attributes-no-value.md) - Prevents values on boolean attributes
- [`html-head-only-elements`](./html-head-only-elements.md) - Require head-scoped elements inside `<head>`.
- [`html-iframe-has-title`](./html-iframe-has-title.md) - `iframe` elements must have a `title` attribute
- [`html-input-require-autocomplete`](./html-input-require-autocomplete.md) - Require `autocomplete` attributes on `<input>` tags.
- [`html-img-require-alt`](./html-img-require-alt.md) - Requires `alt` attributes on `<img>` tags
- [`html-navigation-has-label`](./html-navigation-has-label.md) - Navigation landmarks must have accessible labels
- [`html-no-aria-hidden-on-focusable`](./html-no-aria-hidden-on-focusable.md) - Focusable elements should not have `aria-hidden="true"`
- [`html-no-block-inside-inline`](./html-no-block-inside-inline.md) - Prevents block-level elements inside inline elements
- [`html-no-duplicate-attributes`](./html-no-duplicate-attributes.md) - Prevents duplicate attributes on HTML elements
- [`html-no-duplicate-ids`](./html-no-duplicate-ids.md) - Prevents duplicate IDs within a document
- [`html-no-duplicate-meta-names`](./html-no-duplicate-meta-names.md) - Duplicate `<meta>` name attributes are not allowed.
- [`html-no-empty-attributes`](./html-no-empty-attributes.md) - Attributes must not have empty values
- [`html-no-nested-links`](./html-no-nested-links.md) - Prevents nested anchor tags
- [`html-no-positive-tab-index`](./html-no-positive-tab-index.md) - Avoid positive `tabindex` values
- [`html-no-self-closing`](./html-no-self-closing.md) - Disallow self closing tags
- [`html-no-space-in-tag`](./html-no-space-in-tag.md) - Disallow spaces in HTML tags
- [`html-no-title-attribute`](./html-no-title-attribute.md) - Avoid using the `title` attribute
- [`html-no-underscores-in-attribute-names`](./html-no-underscores-in-attribute-names.md) - Disallow underscores in HTML attribute names
- [`html-tag-name-lowercase`](./html-tag-name-lowercase.md) - Enforces lowercase tag names in HTML
- [`parser-no-errors`](./parser-no-errors.md) - Disallow parser errors in HTML+ERB documents
- [`svg-tag-name-capitalization`](./svg-tag-name-capitalization.md) - Enforces proper camelCase capitalization for SVG elements

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
