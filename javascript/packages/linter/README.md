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

After installing as a dev dependency, add a lint NPM script to your `package.json`:
```json
{
  "scripts": {
    "herb:lint": "herb-lint '**/*.html.erb'"
  }
}
```

Then run the scripts:

:::code-group

```shell [npm]
npm run herb:lint
```

```shell [pnpm]
pnpm herb:lint
```

```shell [yarn]
yarn herb:lint
```

```shell [bun]
bun run herb:lint
```

:::

## Usage

### Command Line

Basic usage:
```bash
npx @herb-tools/linter template.html.erb
npx @herb-tools/linter "**/*.html.erb"
npx @herb-tools/linter app/
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

# Use GitHub Actions output format with detailed preview (default)
# (This is enabled automatically when the GITHUB_ACTIONS environment variable is set)
npx @herb-tools/linter template.html.erb --github

# Combine GitHub Actions output with simple format
npx @herb-tools/linter template.html.erb --format=simple --github

# Combine GitHub Actions output with detailed format (explicit)
npx @herb-tools/linter template.html.erb --format=detailed --github
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

# Combine GitHub Actions annotations with different formats
npx @herb-tools/linter template.html.erb --format=simple --github

# Disable GitHub Actions annotations (even in GitHub Actions environment)
npx @herb-tools/linter template.html.erb --no-github
```

**Help and Version:**
```bash
# Show help
npx @herb-tools/linter --help

# Show version information
npx @herb-tools/linter --version
```

#### GitHub Actions Output Format

The linter supports GitHub Actions annotation format with the `--github` flag, which can be combined with `--format=simple` or `--format=detailed`. The `--github` flag adds GitHub Actions annotations that GitHub can parse to create inline annotations in pull requests, while also showing the regular format output for local debugging.

::: tip Tip: Running in GitHub Actions
When the `GITHUB_ACTIONS` environment variable is set (as in GitHub Actions), GitHub Actions annotations are enabled by default. You can disable them with `--no-github` if needed.
:::

```bash
# GitHub Actions annotations + detailed format (default)
npx @herb-tools/linter --github

# GitHub Actions annotations + simple format (minimal local output)
npx @herb-tools/linter --format=simple --github
```

**Example: `--github` (GitHub annotations + detailed format)**
```
::error file=template.html.erb,line=3,col=3,title=html-img-require-alt • @herb-tools/linter@0.6.1::Missing required `alt` attribute on `<img>` tag [html-img-require-alt]%0A%0A%0Atemplate.html.erb:3:3%0A%0A      1 │ <div>%0A      2 │   <span>Test content</span>%0A  →   3 │   <img src="test.jpg">%0A        │    ~~~%0A      4 │ </div>%0A

[error] Missing required `alt` attribute on `<img>` tag [html-img-require-alt]

template.html.erb:3:3

      1 │ <div>
      2 │   <span>Test content</span>
  →   3 │   <img src="test.jpg">
        │    ~~~
      4 │ </div>
```

**Example: `--format=simple --github` (GitHub annotations + simple format)**
```
::error file=template.html.erb,line=3,col=3,title=html-img-require-alt • @herb-tools/linter@0.6.1::Missing required `alt` attribute on `<img>` tag [html-img-require-alt]%0A%0A%0Atemplate.html.erb:3:3%0A%0A      1 │ <div>%0A      2 │   <span>Test content</span>%0A  →   3 │   <img src="test.jpg">%0A        │    ~~~%0A      4 │ </div>%0A

template.html.erb:
  3:3 ✗ Missing required `alt` attribute on `<img>` tag [html-img-require-alt]
```

The GitHub Actions annotations include:
- **Embedded plain-text code previews** (with `%0A` for newlines) that GitHub renders in PR comments
- **`title` property** showing the rule code and linter version for better traceability
- **Full error context** for debugging directly in GitHub's UI

The regular format output provides colorful syntax highlighting for local terminal debugging.

This approach is ideal for CI/CD workflows as it provides both GitHub integration and local debugging:

```yaml [.github/workflows/herb.yml]
name: Herb Lint
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Herb Linter
        run: npx @herb-tools/linter
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
- `summary`: Statistics about the linting run (`null` on errors)
- `timing`: Timing information with ISO timestamp (`null` with `--no-timing`)
- `completed`: Whether the linter ran successfully on files
- `clean`: Whether there were no offenses (`null` when `completed=false`)
- `message`: Error or informational message (`null` on success)

### Language Server Integration

The linter is automatically integrated into the [Herb Language Server](https://herb-tools.dev/projects/language-server), providing real-time validation in supported editors like VS Code, Zed, and Neovim.
