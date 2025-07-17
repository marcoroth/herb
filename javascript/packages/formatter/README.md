# Herb Formatter <Badge type="warning" text="experimental preview" />

**Package:** [`@herb-tools/formatter`](https://www.npmjs.com/package/@herb-tools/formatter)

> [!WARNING] Experimental Preview
> This formatter is currently in experimental preview. While it works for many common cases, it may potentially corrupt files in edge cases. Only use on files that can be restored via git or other version control systems.

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
herb-format templates/index.html.erb

# absolute path
herb-format /full/path/to/template.html.erb
```

#### Format from stdin

```bash
cat template.html.erb | herb-format
# or explicitly use "-" for stdin
herb-format - < template.html.erb
```

<!-- #### Configuration Options -->

<!-- TODO -->

<!-- #### CLI Usage -->

<!-- TODO -->
