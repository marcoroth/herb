# Herb Linter

**Package**: [`@herb-tools/linter`](https://www.npmjs.com/package/@herb-tools/linter)

---

The Herb Linter provides comprehensive HTML+ERB validation with a set of configurable rules to enforce best practices and catch common errors.

## Installation

### Global Installation

:::code-group

```shell [npm]
npm install -g @herb-tools/linter
```

```shell [pnpm]
pnpm add -g @herb-tools/linter
```

```shell [yarn]
yarn global add @herb-tools/linter
```

```shell [bun]
bun add -g @herb-tools/linter
```

:::

Then run directly:
```bash
herb-lint template.html.erb
```

### One-time Usage
For occasional use without installing:
```bash
npx @herb-tools/linter template.html.erb
```

### Project Installation

:::code-group

```shell [npm]
npm add -D @herb-tools/linter
```

```shell [pnpm]
pnpm add -D @herb-tools/linter
```

```shell [yarn]
yarn add -D @herb-tools/linter
```

```shell [bun]
bun add -D @herb-tools/linter
```

:::

After installing as a dev dependency, add lint scripts to your `package.json`:
```json
{
  "scripts": {
    "herb:lint": "herb-lint",
    "herb:lint:simple": "herb-lint --simple"
  }
}
```

Then run the scripts:

:::code-group

```shell [npm]
npm run herb:lint
npm run herb:lint:simple
npm run herb:lint:json
```

```shell [pnpm]
pnpm herb:lint
pnpm herb:lint:simple
pnpm herb:lint:json
```

```shell [yarn]
yarn herb:lint
yarn herb:lint:simple
yarn herb:lint:json
```

```shell [bun]
bun run herb:lint
bun run herb:lint:simple
bun run herb:lint:json
```

:::

## Usage

### Command Line

Basic usage:
```bash
npx @herb-tools/linter template.html.erb
npx @herb-tools/linter "src/**/*.html.erb"
npx @herb-tools/linter src/
```

#### Options

**Output Format:**
```bash
# Use detailed output (default)
npx @herb-tools/linter template.html.erb --format detailed

# Use simple output format
npx @herb-tools/linter template.html.erb --simple
# or
npx @herb-tools/linter template.html.erb --format simple

# Use JSON output format
npx @herb-tools/linter template.html.erb --json
# or
npx @herb-tools/linter template.html.erb --format json
```

**Display Options:**
```bash
# Disable colored output
npx @herb-tools/linter template.html.erb --no-color

# Set syntax highlighting theme
npx @herb-tools/linter template.html.erb --theme github-dark

# Disable timing information
npx @herb-tools/linter template.html.erb --no-timing

# Disable line wrapping
npx @herb-tools/linter template.html.erb --no-wrap-lines

# Enable line truncation (mutually exclusive with line wrapping)
npx @herb-tools/linter template.html.erb --truncate-lines --no-wrap-lines
```

**Help and Version:**
```bash
# Show help
npx @herb-tools/linter --help

# Show version information
npx @herb-tools/linter --version
```

#### JSON Output Format

The linter supports structured JSON output with the `--json` flag, useful for programmatic consumption:

```bash
npx @herb-tools/linter template.html.erb --json
```

<details>
<summary>Example output:</summary>

```json
{
  "offenses": [
    {
      "filename": "template.html.erb",
      "message": "File must end with trailing newline",
      "location": {
        "start": { "line": 1, "column": 21 },
        "end": { "line": 1, "column": 22 }
      },
      "severity": "error",
      "code": "erb-requires-trailing-newline",
      "source": "Herb Linter"
    }
  ],
  "summary": {
    "filesChecked": 1,
    "filesWithOffenses": 1,
    "totalErrors": 1,
    "totalWarnings": 0,
    "totalOffenses": 1,
    "ruleCount": 21
  },
  "timing": {
    "startTime": "2025-08-14T16:00:48.845Z",
    "duration": 27
  },
  "completed": true,
  "clean": false,
  "message": null
}
```

</details>

JSON output fields:
- `offenses`: Array of linting offenses with location and severity
- `summary`: Statistics about the linting run (null on errors)
- `timing`: Timing information with ISO timestamp (null with `--no-timing`)
- `completed`: Whether the linter ran successfully on files
- `clean`: Whether there were no offenses (null when `completed=false`)
- `message`: Error or informational message (null on success)

### Language Server Integration

The linter is automatically integrated into the [Herb Language Server](https://herb-tools.dev/projects/language-server), providing real-time validation in supported editors like VS Code, Zed, and Neovim.
