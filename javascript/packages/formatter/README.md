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

After installing as a dev dependency, initialize the configuration:

:::code-group

```shell [npm]
npx herb-format --init
```

```shell [pnpm]
pnpm herb-format --init
```

```shell [yarn]
yarn herb-format --init
```

```shell [bun]
bunx herb-format --init
```

:::

Then add format scripts to your `package.json`:
```json [package.json]
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

**Initialize configuration:**
```bash
# Create a .herb.yml configuration file
herb-format --init
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

## Configuration

Create a `.herb.yml` file in your project root to configure the formatter:

```bash
herb-format --init
```

### Basic Configuration

```yaml [.herb.yml]
formatter:
  enabled: true  # Must be enabled for formatting to work
  indentWidth: 2
  maxLineLength: 80

  # Additional glob patterns to include (additive to defaults)
  include:
    - '**/*.xml.erb'

  # Glob patterns to exclude from formatting
  exclude:
    - 'vendor/**/*'
    - 'node_modules/**/*'
    - 'app/views/generated/**/*'
```

### Default File Patterns

By default, the formatter processes:
- `**/*.html`
- `**/*.rhtml`
- `**/*.html.erb`
- `**/*.html+*.erb`
- `**/*.turbo_stream.erb`

The `include` patterns are **additive** - they add to the defaults.

### Configuration Options

- **`enabled`**: `true` or `false` - Must be `true` to enable formatting
- **`indentWidth`**: Number (default: `2`) - Spaces per indentation level
- **`maxLineLength`**: Number (default: `80`) - Maximum line length before wrapping
- **`include`**: Array of glob patterns - Additional patterns to format (additive to defaults)
- **`exclude`**: Array of glob patterns - Patterns to exclude from formatting

### Force Flag

Format files even when formatter is disabled:

```bash
# Force formatting when disabled in config
herb-format --force

# Force formatting on an excluded file
herb-format --force app/views/excluded-file.html.erb
```

When using `--force` on an excluded file, the formatter will show a warning but proceed with formatting.

## Rewriters

The formatter supports **rewriters** that allow you to transform templates before and after formatting.

Configure rewriters in your `.herb.yml`:

```yaml [.herb.yml]
formatter:
  enabled: true
  indentWidth: 2

  rewriter:
    # Pre-format rewriters (run before formatting)
    pre:
      - tailwind-class-sorter

    # Post-format rewriters (run after formatting)
    post: []
```

### Built-in Rewriters

- **`tailwind-class-sorter`** - Automatically sorts Tailwind CSS classes according to the recommended order

### Custom Rewriters

You can create custom rewriters by placing them in `.herb/rewriters/` and referencing them in your config.

For detailed documentation on creating and using rewriters, see the [Rewriter Documentation](/projects/rewriter).
