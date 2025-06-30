# Linter Rules

This directory contains documentation for all Herb Linter rules.

## Available Rules

- [html-attribute-double-quotes](./html-attribute-double-quotes.md) - Enforces double quotes for attribute values
- [html-attribute-values-require-quotes](./html-attribute-values-require-quotes.md) - Requires quotes around attribute values
- [html-boolean-attributes-no-value](./html-boolean-attributes-no-value.md) - Prevents values on boolean attributes
- [html-img-require-alt](./html-img-require-alt.md) - Requires alt attributes on img tags
- [html-no-block-inside-inline](./html-no-block-inside-inline.md) - Prevents block-level elements inside inline elements
- [html-no-duplicate-attributes](./html-no-duplicate-attributes.md) - Prevents duplicate attributes on HTML elements
- [html-no-nested-links](./html-no-nested-links.md) - Prevents nested anchor tags
- [html-tag-name-lowercase](./html-tag-name-lowercase.md) - Enforces lowercase tag names in HTML

## Contributing

To contribute a new rule:

1. Create an issue on GitHub describing the rule
2. Create documentation in this directory following the existing format
3. Implement the rule in `src/rules/`
4. Add comprehensive tests in `test/rules/`
5. Update the main linter to include the rule by default (if appropriate)

See the [html-tag-name-lowercase](./html-tag-name-lowercase.md) rule as an example of a complete implementation.