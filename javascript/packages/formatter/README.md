# Herb Formatter <Badge type="warning" text="experimental preview" />

**Package:** [`@herb-tools/formatter`](https://www.npmjs.com/package/@herb-tools/formatter)

> [!WARNING] Experimental Preview
> This formatter is currently in experimental preview. While it works for many common cases, it may potentially corrupt files in edge cases. Only use on files that can be restored via git or other version control systems.

---

Auto-formatter for HTML+ERB templates with intelligent indentation, line wrapping, and ERB-aware pretty-printing.

Perfect for format-on-save in editors and formatting verification in CI/CD pipelines. Transforms templates into consistently formatted, readable code while preserving all functionality.

## Installation

### Global Installation

:::code-group

```shell [npm]
npm install -g @herb-tools/formatter
```

```shell [pnpm]
pnpm add -g @herb-tools/formatter
```

```shell [yarn]
yarn global add @herb-tools/formatter
```

```shell [bun]
bun add -g @herb-tools/formatter
```

:::

Then run directly:
```bash
herb-format template.html.erb
```

### One-time Usage
For occasional use without installing:

```bash
npx @herb-tools/formatter template.html.erb
```

### Project Installation

:::code-group

```shell [npm]
npm add -D @herb-tools/formatter
```

```shell [pnpm]
pnpm add -D @herb-tools/formatter
```

```shell [yarn]
yarn add -D @herb-tools/formatter
```

```shell [bun]
bun add -D @herb-tools/formatter
```

:::

After installing as a dev dependency, add format scripts to your `package.json`:
```json
{
  "scripts": {
    "herb:format": "herb-format",
    "herb:format:check": "herb-format --check"
  }
}
```

Then run the scripts:

:::code-group

```shell [npm]
npm run herb:format
npm run herb:format:check
```

```shell [pnpm]
pnpm herb:format
pnpm herb:format:check
```

```shell [yarn]
yarn herb:format
yarn herb:format:check
```

```shell [bun]
bun run herb:format
bun run herb:format:check
```

:::

## Usage

### Command Line

Basic usage:
```bash
herb-format
herb-format template.html.erb
herb-format templates/
```

#### Options

**Check Mode:**
```bash
# Check if files are formatted without modifying them
herb-format --check template.html.erb

# Check all files in current directory
herb-format --check
```

**Input Sources:**
```bash
# Format specific file
herb-format templates/index.html.erb

# Format all .html.erb files in directory
herb-format templates/

# Format all .html.erb files in current directory (default)
herb-format

# Format from stdin
cat template.html.erb | herb-format
```

**Help and Version:**
```bash
# Show help
herb-format --help

# Show version information
herb-format --version
```

<!-- #### Configuration Options -->

<!-- TODO -->

<!-- #### CLI Usage -->

<!-- TODO -->
