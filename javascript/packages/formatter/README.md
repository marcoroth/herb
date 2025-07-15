# Herb Formatter <Badge type="info" text="coming soon" />

**Package:** [`@herb-tools/formatter`](https://www.npmjs.com/package/@herb-tools/formatter)

---

Auto-formatter for HTML+ERB templates with intelligent indentation, line wrapping, and ERB-aware pretty-printing.

Perfect for format-on-save in editors and formatting verification in CI/CD pipelines. Transforms templates into consistently formatted, readable code while preserving all functionality.

### Installation


:::code-group
```shell [npm]
npm add @herb-tools/formatter
```

```shell [pnpm]
pnpm add @herb-tools/formatter
```

```shell [yarn]
yarn add @herb-tools/formatter
```

```shell [bun]
bun add @herb-tools/formatter
```
:::

### Usage


#### Format a file

```bash
# relative path
herb-formatter templates/index.html.erb

# absolute path
herb-formatter /full/path/to/template.html.erb
```

#### Format from stdin

```bash
cat template.html.erb | herb-formatter
# or explicitly use "-" for stdin
herb-formatter - < template.html.erb
```

<!-- #### Configuration Options -->

<!-- TODO -->

<!-- #### CLI Usage -->

<!-- TODO -->
