# Linter Rules

This directory contains documentation for all Herb Linter rules.

## Contributing

To contribute a new rule:

1. Create an issue on GitHub describing the rule
2. Create documentation in this directory following the existing format
3. Implement the rule in `src/rules/`
4. Add comprehensive tests in `test/rules/`
5. Update the main linter to include the rule by default (if appropriate)

See the [html-tag-name-lowercase](./html-tag-name-lowercase.md) rule as an example of a complete implementation.
